/**
 * Invoice generation — §5.4 of the specification.
 *
 * Four rules govern everything here:
 *   1. The room price divides equally among ACTUAL occupants, not capacity.
 *   2. The occupant count is FIXED at generation and never recalculated.
 *   3. The closing balance carries forward into next month's opening balance.
 *   5. There is no late fee. Grace changes the status, never the money.
 *
 * Rule 2 is why every invoice snapshots roomRentAtBilling and
 * occupantCountAtBilling. A bill that changes after it has been paid causes
 * more disputes than it prevents.
 */

import { prisma } from './db.js';
import { splitRent } from './money.js';
import { dateOnly, monthLabel, rotationFor } from './dates.js';

export const DEFAULT_RENT_DUE_DAY = 5;
export const DEFAULT_GRACE_DAYS = 7;

/** INV-2026-08-0001 — readable, sortable, and unique per period. */
export function invoiceNumber(year, month, seq) {
  return `INV-${year}-${String(month).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;
}

/**
 * A closing balance of zero or below is Paid — §5.4 Rule 3. Below zero is
 * credit, which happens when a student pays several months at once.
 * OVERDUE is not decided here; it is a function of the date, applied later.
 */
export function invoiceStatusFor({ closingBalance, amountPaid }) {
  if (closingBalance <= 0) return 'PAID';
  if (amountPaid > 0) return 'PARTIAL';
  return 'UNPAID';
}

/** Add days to a @db.Date without letting a timezone shift the calendar day. */
export function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * The due date for a month, clamped so that day 31 in a 30-day month lands on
 * the last day rather than silently rolling into the next one.
 */
export function dueDateFor(year, month, rentDueDay) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(rentDueDay, 1), lastDay);
  return dateOnly(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
}

/**
 * What a student pays when relief applies, and the discount that represents.
 *
 * `payPercent` is what they still pay — 50 means half — because "half off" and
 * "pays half" are the same words for different money, and the figure has to be
 * unambiguous by the time it reaches here.
 *
 * Rounded to whole shillings so a discounted share never carries stray cents.
 */
export function reliefDiscount(rentShare, payPercent) {
  const pct = Math.min(Math.max(payPercent, 0), 100);
  const shillings = Math.round(rentShare / 100);
  const paysShillings = Math.round((shillings * pct) / 100);
  return (shillings - paysShillings) * 100;
}

const monthKey = (year, month) => year * 12 + month;

/** The relief in force for a given month, if any. Latest approval wins. */
export function reliefForMonth(reliefs, year, month) {
  const key = monthKey(year, month);
  const live = reliefs.filter((r) =>
    r.cancelledAt === null
    && monthKey(r.startYear, r.startMonth) <= key
    && monthKey(r.endYear, r.endMonth) >= key);
  if (live.length === 0) return null;
  return live.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
}

/** Find or create the billing period for a month. Safe to call repeatedly. */
export async function periodFor(year, month, client = prisma) {
  const existing = await client.billingPeriod.findUnique({
    where: { year_month: { year, month } },
  });
  if (existing) return existing;
  return client.billingPeriod.create({
    data: { year, month, label: monthLabel(year, month) },
  });
}

/**
 * The opening balance for each student's first invoice of a period.
 *
 * Normally it is the closing balance of their most recent earlier invoice. For
 * a student who has never been invoiced it is the figure entered from the last
 * paper sheet — §15's transition, where one number carries all their history.
 */
async function openingBalances(studentIds, year, month, client) {
  const priors = await client.invoice.findMany({
    where: {
      studentId: { in: studentIds },
      period: { OR: [{ year: { lt: year } }, { year, month: { lt: month } }] },
    },
    select: {
      studentId: true,
      closingBalance: true,
      period: { select: { year: true, month: true } },
    },
  });

  // Latest earlier invoice wins. Sorting in memory keeps it to one query.
  const latest = new Map();
  for (const inv of priors) {
    const key = inv.period.year * 12 + inv.period.month;
    const held = latest.get(inv.studentId);
    if (!held || key > held.key) latest.set(inv.studentId, { key, value: inv.closingBalance });
  }
  return latest;
}

/**
 * Build every invoice for a period without writing anything.
 *
 * Separated from the write so the same figures can be shown as a preview before
 * the administrator commits — and so this half can be tested without a database.
 */
export async function planPeriod(period, client = prisma) {
  const { year, month } = period;
  const settings = await client.settings.findUnique({ where: { id: 'singleton' } });
  const rentDueDay = settings?.rentDueDay ?? DEFAULT_RENT_DUE_DAY;
  const graceDays = settings?.graceDays ?? DEFAULT_GRACE_DAYS;

  const dueDate = dueDateFor(year, month, rentDueDay);
  const graceEndsOn = addDays(dueDate, graceDays);
  const rotation = rotationFor(year, month);

  // Only rooms that somebody is actually living in produce invoices.
  const rooms = await client.room.findMany({
    where: { occupancies: { some: { status: 'ACTIVE' } } },
    include: {
      block: { select: { name: true } },
      occupancies: {
        where: { status: 'ACTIVE' },
        orderBy: { startDate: 'asc' },
        include: {
          student: {
            select: {
              id: true, fullName: true, openingBalance: true,
              reliefs: { where: { cancelledAt: null } },
            },
          },
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  const studentIds = rooms.flatMap((r) => r.occupancies.map((o) => o.student.id));
  if (studentIds.length === 0) return { rows: [], dueDate, graceEndsOn, alreadyBilled: 0 };

  const [carried, existing] = await Promise.all([
    openingBalances(studentIds, year, month, client),
    client.invoice.findMany({
      where: { periodId: period.id },
      select: { studentId: true },
    }),
  ]);
  const billed = new Set(existing.map((i) => i.studentId));

  const rows = [];
  for (const room of rooms) {
    const occupants = room.occupancies.length;
    const shares = splitRent(room.monthlyRent, occupants, rotation);

    room.occupancies.forEach((occ, i) => {
      const student = occ.student;
      if (billed.has(student.id)) return; // Rule: one invoice per student per month.

      const openingBalance = carried.get(student.id)?.value ?? student.openingBalance ?? 0;
      const rentShare = shares[i] ?? 0;

      // Placement or a negotiated arrangement, decided once and applied every
      // month it covers — §5.4 Rule 4.
      const relief = reliefForMonth(student.reliefs ?? [], year, month);
      const discount = relief ? reliefDiscount(rentShare, relief.payPercent) : 0;
      const discountReason = relief
        ? `${relief.reason} — pays ${relief.payPercent}% of the share`
        : null;

      const totalPayable = openingBalance + rentShare - discount;

      rows.push({
        studentId: student.id,
        studentName: student.fullName,
        roomId: room.id,
        roomCode: room.code,
        blockName: room.block.name,
        roomRentAtBilling: room.monthlyRent,
        occupantCountAtBilling: occupants,
        openingBalance,
        rentShare,
        discount,
        discountReason,
        totalPayable,
        closingBalance: totalPayable,
        dueDate,
        graceEndsOn,
        status: invoiceStatusFor({ closingBalance: totalPayable, amountPaid: 0 }),
      });
    });
  }

  return { rows, dueDate, graceEndsOn, alreadyBilled: billed.size };
}

/**
 * Write the planned invoices.
 *
 * Safe to re-run: students already invoiced for the period are skipped in the
 * plan, and the unique constraint on (studentId, periodId) is the backstop if
 * two people press the button at once.
 */
export async function generatePeriod(period, client = prisma) {
  const plan = await planPeriod(period, client);
  if (plan.rows.length === 0) return { created: 0, ...plan };

  const seqStart = await client.invoice.count({ where: { periodId: period.id } });

  const result = await client.invoice.createMany({
    data: plan.rows.map((r, i) => ({
      invoiceNo: invoiceNumber(period.year, period.month, seqStart + i + 1),
      studentId: r.studentId,
      roomId: r.roomId,
      periodId: period.id,
      roomRentAtBilling: r.roomRentAtBilling,
      occupantCountAtBilling: r.occupantCountAtBilling,
      rentShare: r.rentShare,
      discount: r.discount,
      discountReason: r.discountReason,
      openingBalance: r.openingBalance,
      totalPayable: r.totalPayable,
      closingBalance: r.closingBalance,
      dueDate: r.dueDate,
      graceEndsOn: r.graceEndsOn,
      status: r.status,
    })),
    skipDuplicates: true,
  });

  await client.billingPeriod.update({
    where: { id: period.id },
    data: { generatedAt: new Date(), dueDate: plan.dueDate },
  });

  return { created: result.count, ...plan };
}

/** The sheet for one month, grouped by room — §5.7. */
export async function ledgerFor(periodId, client = prisma) {
  const invoices = await client.invoice.findMany({
    where: { periodId },
    include: {
      student: { select: { id: true, fullName: true } },
      room: { select: { id: true, code: true, block: { select: { name: true } } } },
    },
    orderBy: [{ room: { code: 'asc' } }, { student: { fullName: 'asc' } }],
  });

  const byRoom = new Map();
  for (const inv of invoices) {
    const key = inv.room.id;
    if (!byRoom.has(key)) {
      byRoom.set(key, {
        roomId: key,
        roomCode: inv.room.code,
        blockName: inv.room.block.name,
        rows: [],
        roomRent: inv.roomRentAtBilling,
      });
    }
    byRoom.get(key).rows.push(inv);
  }

  const totals = invoices.reduce(
    (acc, i) => ({
      opening: acc.opening + i.openingBalance,
      rent: acc.rent + i.rentShare,
      charges: acc.charges + i.chargesTotal,
      discount: acc.discount + i.discount,
      paid: acc.paid + i.amountPaid,
      balance: acc.balance + i.closingBalance,
    }),
    { opening: 0, rent: 0, charges: 0, discount: 0, paid: 0, balance: 0 },
  );

  return { rooms: [...byRoom.values()], invoices, totals };
}
