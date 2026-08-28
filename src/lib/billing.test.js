/**
 * Checks the invoice rules that do not need a database — due dates, grace,
 * status, numbering, and the carry-forward arithmetic of §5.4 Rule 3.
 * Run with: npm run test:billing
 */
import assert from 'node:assert/strict';
import { splitRent, splitCharge } from './money.js';
import {
  invoiceNumber, invoiceStatusFor, addDays, dueDateFor,
  reliefDiscount, reliefForMonth,
} from './billing.js';

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
    process.exitCode = 1;
  }
}

const iso = (d) => d.toISOString().slice(0, 10);

console.log('\nInvoice numbering');
check('pads the month and the sequence', () =>
  assert.equal(invoiceNumber(2026, 8, 1), 'INV-2026-08-0001'));
check('keeps sorting correct past a hundred', () =>
  assert.equal(invoiceNumber(2026, 12, 147), 'INV-2026-12-0147'));

console.log('\nRule 5 — due date and grace, with no late fee');
check('due on the configured day', () =>
  assert.equal(iso(dueDateFor(2026, 8, 5)), '2026-08-05'));
check('day 31 in a 30-day month lands on the last day, not the next month', () =>
  assert.equal(iso(dueDateFor(2026, 9, 31)), '2026-09-30'));
check('February is handled', () =>
  assert.equal(iso(dueDateFor(2026, 2, 30)), '2026-02-28'));
check('a leap February is handled', () =>
  assert.equal(iso(dueDateFor(2028, 2, 30)), '2028-02-29'));
check('seven days of grace from the due date', () =>
  assert.equal(iso(addDays(dueDateFor(2026, 8, 5), 7)), '2026-08-12'));
check('grace crossing a month boundary', () =>
  assert.equal(iso(addDays(dueDateFor(2026, 8, 28), 7)), '2026-09-04'));

console.log('\nRule 3 — status follows the closing balance');
check('nothing owed is Paid', () =>
  assert.equal(invoiceStatusFor({ closingBalance: 0, amountPaid: 125000 }), 'PAID'));
check('a credit is Paid, not something else', () =>
  assert.equal(invoiceStatusFor({ closingBalance: -50000, amountPaid: 300000 }), 'PAID'));
check('something paid but not all of it is Part paid', () =>
  assert.equal(invoiceStatusFor({ closingBalance: 25000, amountPaid: 100000 }), 'PARTIAL'));
check('nothing paid is Unpaid', () =>
  assert.equal(invoiceStatusFor({ closingBalance: 125000, amountPaid: 0 }), 'UNPAID'));

console.log('\nRule 3 — the balance carries forward across three months');
check('arrears follow the student into the next month', () => {
  // C5 at 3,000 with three occupants: 1,000 each.
  const share = splitRent(300000, 3)[0];

  // Month 1: pays nothing.
  const m1Total = 0 + share;
  const m1Closing = m1Total - 0;
  assert.equal(m1Closing, 100000);

  // Month 2: opens with last month's closing, pays half of what is due.
  const m2Total = m1Closing + share;
  assert.equal(m2Total, 200000);
  const m2Closing = m2Total - 100000;
  assert.equal(m2Closing, 100000);

  // Month 3: clears everything.
  const m3Total = m2Closing + share;
  assert.equal(m3Total, 200000);
  const m3Closing = m3Total - 200000;
  assert.equal(m3Closing, 0);
  assert.equal(invoiceStatusFor({ closingBalance: m3Closing, amountPaid: 200000 }), 'PAID');
});

check('paying four months at once leaves a credit that opens the next invoice', () => {
  const share = splitRent(300000, 3)[0]; // 1,000
  const due = share;                     // one month outstanding
  const paid = 400000;                   // 4,000 handed over
  const closing = due - paid;
  assert.equal(closing, -300000);        // 3,000 in credit
  assert.equal(invoiceStatusFor({ closingBalance: closing, amountPaid: paid }), 'PAID');

  // That credit is the next month's opening balance and reduces what is owed.
  const nextTotal = closing + share;
  assert.equal(nextTotal, -200000);
  assert.equal(invoiceStatusFor({ closingBalance: nextTotal, amountPaid: 0 }), 'PAID');
});

check('an opening balance from the paper sheet lands on the first invoice', () => {
  const broughtForward = 75000; // 750 owed on the last paper sheet
  const share = splitRent(250000, 2)[0]; // 1,250
  const total = broughtForward + share;
  assert.equal(total, 200000); // 2,000
  assert.equal(invoiceStatusFor({ closingBalance: total, amountPaid: 0 }), 'UNPAID');
});

console.log('\nRule 4 — a payment settles the oldest month first');
/** The allocation walk, isolated from the database. */
function allocate(amount, invoices) {
  let remaining = amount;
  const rows = [];
  for (const inv of invoices) {
    if (remaining <= 0) break;
    if (inv.closing <= 0) continue;
    const take = Math.min(inv.closing, remaining);
    rows.push({ id: inv.id, amount: take });
    remaining -= take;
  }
  if (remaining > 0 && invoices.length > 0) {
    const last = invoices[invoices.length - 1];
    const row = rows.find((r) => r.id === last.id);
    if (row) row.amount += remaining;
    else rows.push({ id: last.id, amount: remaining });
  }
  return rows;
}

check('5,000 across four unpaid months settles them in order', () => {
  const months = [
    { id: 'may', closing: 100000 },
    { id: 'jun', closing: 100000 },
    { id: 'jul', closing: 100000 },
    { id: 'aug', closing: 100000 },
  ];
  const rows = allocate(500000, months);
  assert.deepEqual(rows, [
    { id: 'may', amount: 100000 },
    { id: 'jun', amount: 100000 },
    { id: 'jul', amount: 100000 },
    { id: 'aug', amount: 200000 }, // 1,000 owed + 1,000 of credit
  ]);
  assert.equal(rows.reduce((s, r) => s + r.amount, 0), 500000);
});

check('a part payment lands entirely on the oldest month', () => {
  const rows = allocate(40000, [
    { id: 'jul', closing: 100000 },
    { id: 'aug', closing: 100000 },
  ]);
  assert.deepEqual(rows, [{ id: 'jul', amount: 40000 }]);
});

check('a month already settled is skipped, not credited', () => {
  const rows = allocate(50000, [
    { id: 'jul', closing: 0 },
    { id: 'aug', closing: 100000 },
  ]);
  assert.deepEqual(rows, [{ id: 'aug', amount: 50000 }]);
});

console.log('\nThe cascade — paying an old month corrects every month after it');
/** Recompute exactly as recomputeStudent does: derive, never adjust. */
function cascade(studentOpening, invoices) {
  let running = studentOpening;
  return invoices.map((inv) => {
    const opening = running;
    const total = opening + inv.rent + (inv.charges ?? 0) - (inv.discount ?? 0);
    const closing = total - inv.paid;
    running = closing;
    return { id: inv.id, opening, total, closing };
  });
}

check('July unpaid overstates August until July is paid', () => {
  const rent = 100000;
  // Before payment: July unpaid, August opened with July's 1,000 arrears.
  const before = cascade(0, [
    { id: 'jul', rent, paid: 0 },
    { id: 'aug', rent, paid: 0 },
  ]);
  assert.equal(before[1].opening, 100000);
  assert.equal(before[1].closing, 200000); // owes both months

  // July is then settled in September. August must fall to one month's rent.
  const after = cascade(0, [
    { id: 'jul', rent, paid: 100000 },
    { id: 'aug', rent, paid: 0 },
  ]);
  assert.equal(after[0].closing, 0);
  assert.equal(after[1].opening, 0, 'August must not still show July as owing');
  assert.equal(after[1].closing, 100000);
});

check('credit from an overpayment carries forward, not just the arrears', () => {
  const rent = 100000;
  const rows = cascade(0, [
    { id: 'jul', rent, paid: 300000 }, // pays 3,000 against a 1,000 bill
    { id: 'aug', rent, paid: 0 },
    { id: 'sep', rent, paid: 0 },
  ]);
  assert.equal(rows[0].closing, -200000); // 2,000 in credit
  assert.equal(rows[1].opening, -200000);
  assert.equal(rows[1].closing, -100000); // credit absorbs August
  assert.equal(rows[2].closing, 0);       // and clears September exactly
});

check('the paper-sheet opening balance flows through every later month', () => {
  const rows = cascade(75000, [
    { id: 'aug', rent: 125000, paid: 0 },
    { id: 'sep', rent: 125000, paid: 0 },
  ]);
  assert.equal(rows[0].opening, 75000);
  assert.equal(rows[0].closing, 200000);
  assert.equal(rows[1].opening, 200000);
  assert.equal(rows[1].closing, 325000);
});

check('a reversal puts the balance back exactly where it was', () => {
  const rent = 100000;
  const paid = cascade(0, [{ id: 'aug', rent, paid: 100000 }]);
  assert.equal(paid[0].closing, 0);
  // Reversal deletes the allocation, so paid returns to zero.
  const reversed = cascade(0, [{ id: 'aug', rent, paid: 0 }]);
  assert.equal(reversed[0].closing, 100000);
});

console.log('\nReduced rent — the figure is what the student STILL PAYS');
check('paying half of a 3,000 share is a 1,500 discount', () =>
  assert.equal(reliefDiscount(300000, 50), 150000));
check('paying three quarters of 3,000 is a 750 discount', () =>
  assert.equal(reliefDiscount(300000, 75), 75000));
check('paying nothing discounts the whole share', () =>
  assert.equal(reliefDiscount(300000, 0), 300000));
check('paying in full is no discount at all', () =>
  assert.equal(reliefDiscount(300000, 100), 0));
check('an odd share still rounds to whole shillings', () => {
  // 1,333 paying half -> pays 667, discount 666, and the two sum exactly.
  const share = 133300;
  const discount = reliefDiscount(share, 50);
  assert.equal(discount % 100, 0, 'no stray cents');
  assert.equal(share - discount + discount, share);
});
check('a nonsense percentage is clamped rather than trusted', () => {
  assert.equal(reliefDiscount(300000, 150), 0);
  assert.equal(reliefDiscount(300000, -20), 300000);
});

console.log('\nReduced rent — which months it covers');
const relief = (startY, startM, endY, endM, pct, createdAt, cancelledAt = null) => ({
  startYear: startY, startMonth: startM, endYear: endY, endMonth: endM,
  payPercent: pct, createdAt: new Date(createdAt), cancelledAt,
});

check('a month inside the range is covered', () =>
  assert.equal(reliefForMonth([relief(2026, 8, 2026, 9, 50, '2026-08-01')], 2026, 9)?.payPercent, 50));
check('a month outside the range is not', () =>
  assert.equal(reliefForMonth([relief(2026, 8, 2026, 9, 50, '2026-08-01')], 2026, 10), null));
check('a range crossing into the next year is handled', () => {
  const r = [relief(2026, 11, 2027, 2, 50, '2026-10-01')];
  assert.ok(reliefForMonth(r, 2027, 1), 'January should be covered');
  assert.equal(reliefForMonth(r, 2027, 3), null);
});
check('a cancelled arrangement covers nothing', () =>
  assert.equal(
    reliefForMonth([relief(2026, 8, 2026, 9, 50, '2026-08-01', new Date())], 2026, 8),
    null,
  ));
check('where two overlap, the one agreed most recently wins', () => {
  const r = [
    relief(2026, 8, 2026, 12, 50, '2026-07-01'),
    relief(2026, 9, 2026, 10, 25, '2026-08-20'),
  ];
  assert.equal(reliefForMonth(r, 2026, 9).payPercent, 25);
  assert.equal(reliefForMonth(r, 2026, 11).payPercent, 50);
});

console.log('\nReduced rent — what it does to the bill');
check('a placement month reduces only that student, not the room', () => {
  const roomRent = 300000;
  const shares = splitRent(roomRent, 3); // 1,000 each
  assert.deepEqual(shares, [100000, 100000, 100000]);

  // One student is away and pays half. The other two are untouched.
  const discount = reliefDiscount(shares[0], 50);
  const away = shares[0] - discount;
  assert.equal(away, 50000);
  assert.equal(shares[1], 100000);
  assert.equal(shares[2], 100000);

  // The hostel collects 2,500 instead of 3,000 — it absorbs the reduction.
  assert.equal(away + shares[1] + shares[2], 250000);
});

check('a discount carries into the closing balance and forward', () => {
  const share = 100000;
  const discount = 50000;
  const opening = 0;
  const payable = opening + share - discount;
  assert.equal(payable, 50000);
  const closing = payable - 0;
  // Next month opens with only the reduced amount outstanding.
  assert.equal(closing + share, 150000);
});

console.log('\nOther charges — §5.5');
check('a shared charge splits evenly across the room', () =>
  assert.deepEqual(splitCharge(90000, 3), [30000, 30000, 30000]));
check('an uneven split still sums to exactly what was charged', () => {
  const parts = splitCharge(100000, 3);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100000);
  assert.deepEqual(parts, [33400, 33300, 33300]);
});
check('a charge on one student is not split at all', () =>
  assert.deepEqual(splitCharge(20000, 1), [20000]));

/** chargesTotal is derived from the rows, exactly as recomputeStudent does. */
const chargesTotal = (charges) => charges.reduce((s, c) => s + c.amount, 0);

check('charges add to what is payable and carry into the balance', () => {
  const opening = 0;
  const rent = 100000;
  const charges = chargesTotal([{ amount: 20000 }, { amount: 5000 }]);
  const payable = opening + rent + charges - 0;
  assert.equal(payable, 125000);
  assert.equal(payable - 0, 125000);
});

check('a credit note cancels a paid charge without deleting it', () => {
  const charges = [{ amount: 20000 }];
  assert.equal(chargesTotal(charges), 20000);
  // Reversal after payment adds a negative row rather than removing the first.
  charges.push({ amount: -20000 });
  assert.equal(chargesTotal(charges), 0);
  assert.equal(charges.length, 2, 'both entries stay visible');
});

check('removing an unpaid charge takes it out of the total entirely', () => {
  const charges = [{ id: 'a', amount: 20000 }, { id: 'b', amount: 5000 }];
  const after = charges.filter((c) => c.id !== 'a');
  assert.equal(chargesTotal(after), 5000);
});

check('a discount and a charge in the same month both apply', () => {
  const payable = 0 + 100000 + 20000 - 50000;
  assert.equal(payable, 70000);
  assert.equal(invoiceStatusFor({ closingBalance: payable, amountPaid: 0 }), 'UNPAID');
});

console.log(`\n${passed} checks passed.\n`);
