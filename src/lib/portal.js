/**
 * What a student is allowed to see about their own account, and about the
 * people they share a room with.
 *
 * §4 is specific about the roommate view: name, share, paid or unpaid, and the
 * room total. Not each other's statements, not their phone numbers, not what
 * they owe overall — only what is needed to see whether the room is square.
 */

import { prisma } from './db.js';
import { nairobiToday } from './dates.js';

export async function currentPeriod(client = prisma) {
  const { year, month } = nairobiToday();
  return client.billingPeriod.findUnique({ where: { year_month: { year, month } } });
}

export async function portalSummary(studentId, client = prisma) {
  const student = await client.student.findUnique({
    where: { id: studentId },
    include: {
      occupancies: {
        where: { status: 'ACTIVE' },
        include: { room: { include: { block: { select: { name: true } } } } },
        take: 1,
      },
      invoices: {
        include: { period: { select: { year: true, month: true, label: true } } },
      },
      payments: {
        where: { status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!student) return null;

  const invoices = [...student.invoices].sort(
    (a, b) => (a.period.year * 12 + a.period.month) - (b.period.year * 12 + b.period.month),
  );
  const latest = invoices[invoices.length - 1] ?? null;
  const balance = latest ? latest.closingBalance : student.openingBalance;

  const occupancy = student.occupancies[0] ?? null;
  const period = await currentPeriod(client);

  // Roommates, and only for the month everyone is currently being billed for.
  let roommates = [];
  let roomTotal = null;
  if (occupancy && period) {
    const shared = await client.invoice.findMany({
      where: { roomId: occupancy.roomId, periodId: period.id },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { student: { fullName: 'asc' } },
    });
    roommates = shared.map((inv) => ({
      id: inv.student.id,
      name: inv.student.fullName,
      isYou: inv.student.id === studentId,
      share: inv.rentShare - inv.discount,
      settled: inv.closingBalance <= 0,
    }));
    roomTotal = shared.reduce((sum, inv) => sum + (inv.rentShare - inv.discount), 0);
  }

  // A claim awaiting a decision is shown alongside the balance, never inside it.
  const pendingClaim = student.payments.find((p) => p.status === 'SUBMITTED') ?? null;

  return {
    student,
    occupancy,
    room: occupancy?.room ?? null,
    invoices,
    latest,
    balance,
    roommates,
    roomTotal,
    period,
    payments: student.payments,
    pendingClaim,
  };
}

/** The rules the student must currently be signed up to, and whether they are. */
export async function rulesState(studentId, client = prisma) {
  const rules = await client.hostelRules.findFirst({ where: { isCurrent: true } });
  if (!rules) return { rules: null, signed: false, signedAt: null };

  const ack = await client.ruleAcknowledgement.findUnique({
    where: { studentId_rulesId: { studentId, rulesId: rules.id } },
  });
  return { rules, signed: Boolean(ack), signedAt: ack?.acknowledgedAt ?? null };
}
