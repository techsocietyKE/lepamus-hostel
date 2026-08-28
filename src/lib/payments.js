/**
 * Payment allocation and balance recomputation — §5.4 Rules 3 and 4, §5.6.
 *
 * The rule that makes the whole design safe: a SUBMITTED payment never touches
 * an invoice. Only an APPROVED one is allocated. Without that a student could
 * clear their own account by typing a number.
 *
 * The second rule, less obvious and easier to get wrong: paying an old invoice
 * must correct every invoice after it. If July is settled in September, the
 * August invoice's opening balance — snapshotted when it was generated — is now
 * overstated, and the student is asked twice for the same money. That is the
 * hand-carried-balance error this system exists to eliminate, so it is not
 * acceptable to reproduce it automatically. `recomputeStudent` cascades.
 */

import { prisma } from './db.js';
import { invoiceStatusFor } from './billing.js';
import { nairobiToday } from './dates.js';

/** RCP-2026-08-0001 — the system's own receipt, separate from any M-Pesa code. */
export function receiptNumber(year, month, seq) {
  return `RCP-${year}-${String(month).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;
}

export async function nextReceiptNumber(client = prisma) {
  const { year, month } = nairobiToday();
  const prefix = `RCP-${year}-${String(month).padStart(2, '0')}-`;
  const count = await client.payment.count({ where: { receiptNo: { startsWith: prefix } } });
  return receiptNumber(year, month, count + 1);
}

const periodKey = (p) => p.year * 12 + p.month;

/**
 * Rebuild every invoice for one student from first principles.
 *
 * Nothing here is incremental: the opening balance of the first invoice is the
 * figure carried off the paper sheet, and each invoice after it opens with the
 * previous closing balance. Because it derives `amountPaid` from the allocation
 * records rather than adjusting a stored total, running it twice is harmless.
 */
export async function recomputeStudent(studentId, client = prisma) {
  const student = await client.student.findUnique({
    where: { id: studentId },
    select: { openingBalance: true },
  });
  if (!student) return { updated: 0 };

  const invoices = await client.invoice.findMany({
    where: { studentId },
    include: {
      period: { select: { year: true, month: true } },
      allocations: { select: { amount: true } },
      charges: { select: { amount: true } },
    },
  });
  invoices.sort((a, b) => periodKey(a.period) - periodKey(b.period));

  const today = nairobiToday();
  const todayKey = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  let running = student.openingBalance ?? 0;
  let updated = 0;

  for (const inv of invoices) {
    const amountPaid = inv.allocations.reduce((sum, a) => sum + a.amount, 0);
    // Derived from the charge rows, never adjusted in place — a stored total
    // that nothing maintains drifts away from the charges it is meant to sum,
    // and the drift is invisible until someone queries a figure.
    const chargesTotal = inv.charges.reduce((sum, c) => sum + c.amount, 0);
    const openingBalance = running;
    const totalPayable = openingBalance + inv.rentShare + chargesTotal - inv.discount;
    const closingBalance = totalPayable - amountPaid;

    let status;
    if (inv.status === 'WAIVED') {
      status = 'WAIVED';
    } else {
      status = invoiceStatusFor({ closingBalance, amountPaid });
      // Rule 5: grace changes the status and never the money.
      if (status !== 'PAID' && inv.graceEndsOn.toISOString().slice(0, 10) < todayKey) {
        status = 'OVERDUE';
      }
    }

    const changed = inv.openingBalance !== openingBalance
      || inv.totalPayable !== totalPayable
      || inv.amountPaid !== amountPaid
      || inv.chargesTotal !== chargesTotal
      || inv.closingBalance !== closingBalance
      || inv.status !== status;

    if (changed) {
      await client.invoice.update({
        where: { id: inv.id },
        data: { openingBalance, totalPayable, amountPaid, chargesTotal, closingBalance, status },
      });
      updated += 1;
    }

    running = closingBalance;
  }

  return { updated, closingBalance: running };
}

/**
 * Spread an approved payment across a student's invoices, oldest first — Rule 4.
 *
 * Anything left after every outstanding invoice is settled goes onto the most
 * recent invoice, pushing its closing balance negative. That is exactly what
 * Rule 3 calls credit, and the cascade then carries it into the next month
 * automatically rather than leaving money sitting outside the ledger.
 */
export async function allocatePayment(paymentId, client = prisma) {
  const payment = await client.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('That payment no longer exists.');
  if (payment.status !== 'APPROVED') {
    throw new Error('Only an approved payment can be allocated.');
  }

  const existing = await client.paymentAllocation.count({ where: { paymentId } });
  if (existing > 0) return { allocated: 0, credit: 0, alreadyAllocated: true };

  const invoices = await client.invoice.findMany({
    where: { studentId: payment.studentId, status: { not: 'WAIVED' } },
    include: { period: { select: { year: true, month: true } } },
  });
  invoices.sort((a, b) => periodKey(a.period) - periodKey(b.period));

  if (invoices.length === 0) {
    // Paid before anything was billed. The money is on record and will be
    // allocated the moment an invoice exists.
    return { allocated: 0, credit: payment.amount, unbilled: true };
  }

  let remaining = payment.amount;
  const rows = [];

  for (const inv of invoices) {
    if (remaining <= 0) break;
    const owed = inv.closingBalance;
    if (owed <= 0) continue;
    const take = Math.min(owed, remaining);
    rows.push({ paymentId, invoiceId: inv.id, amount: take });
    remaining -= take;
  }

  // Overpayment becomes a credit on the newest invoice.
  if (remaining > 0) {
    const latest = invoices[invoices.length - 1];
    const row = rows.find((r) => r.invoiceId === latest.id);
    if (row) row.amount += remaining;
    else rows.push({ paymentId, invoiceId: latest.id, amount: remaining });
    remaining = 0;
  }

  if (rows.length > 0) {
    await client.paymentAllocation.createMany({ data: rows });
  }

  return { allocated: rows.length, credit: 0 };
}

/**
 * Where each student stands right now — the closing balance of their most
 * recent invoice, or the paper-sheet figure if they have never been billed.
 * The verification queue needs this to show what a balance would become.
 */
export async function studentBalances(studentIds, client = prisma) {
  const [students, invoices] = await Promise.all([
    client.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, openingBalance: true },
    }),
    client.invoice.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        closingBalance: true,
        period: { select: { year: true, month: true } },
      },
    }),
  ]);

  const balances = new Map(students.map((s) => [s.id, s.openingBalance ?? 0]));
  const newest = new Map();
  for (const inv of invoices) {
    const key = periodKey(inv.period);
    const held = newest.get(inv.studentId);
    if (!held || key > held.key) newest.set(inv.studentId, { key, value: inv.closingBalance });
  }
  for (const [studentId, { value }] of newest) balances.set(studentId, value);
  return balances;
}

/** Allocate, then correct every invoice from the oldest touched month onward. */
export async function applyPayment(paymentId, studentId, client = prisma) {
  const result = await allocatePayment(paymentId, client);
  const recomputed = await recomputeStudent(studentId, client);
  return { ...result, ...recomputed };
}
