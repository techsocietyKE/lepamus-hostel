'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireStudent } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { fmt } from '@/lib/money';
import { dateOnly, isoDate } from '@/lib/dates';
import { submitPaymentSchema, vacateRequestSchema, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

function refresh() {
  revalidatePath('/portal');
  revalidatePath('/portal/pay');
  revalidatePath('/portal/statement');
  revalidatePath('/admin/payments');
  revalidatePath('/admin');
}

/**
 * A student submitting a payment for checking — §5.6.
 *
 * The claim is recorded as SUBMITTED and changes no balance. That single rule
 * is what stops a student clearing their own account by typing a number, and it
 * is enforced here rather than in the interface: this action never allocates,
 * never recomputes, and never touches an invoice.
 */
export async function submitPayment(prevState, formData) {
  try {
    const me = await requireStudent();
    const parsed = submitPaymentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const d = parsed.data;

    // The code is unique across the whole system — the single most important
    // safeguard in the payment design. Checked here so the student gets a
    // sentence rather than a constraint violation.
    const clash = await prisma.payment.findUnique({
      where: { transactionCode: d.transactionCode },
    });
    if (clash) {
      return fail(
        `${d.transactionCode} has already been submitted. If you think that is wrong, speak to the office.`,
        { transactionCode: 'Already submitted' },
      );
    }

    // A second identical claim while the first is undecided is an impatient
    // tap, not a second payment.
    const duplicate = await prisma.payment.findFirst({
      where: {
        studentId: me.id,
        status: 'SUBMITTED',
        amountClaimed: d.amount,
        paidAt: dateOnly(d.paidAt),
      },
    });
    if (duplicate) {
      return fail(
        'You have already submitted that amount for that date, and it is still being checked.',
      );
    }

    if (d.paidAt > isoDate()) {
      return fail('That date is in the future.', { paidAt: 'Check the date' });
    }

    const payment = await prisma.payment.create({
      data: {
        studentId: me.id,
        amountClaimed: d.amount,
        // Held so the row is valid; only approval decides what actually moves.
        amount: d.amount,
        method: 'MPESA_TILL',
        status: 'SUBMITTED',
        transactionCode: d.transactionCode,
        payerPhone: d.payerPhone,
        paidAt: dateOnly(d.paidAt),
        submittedAt: new Date(),
      },
    });

    await writeAudit(prisma, {
      action: 'PAYMENT_SUBMITTED', entity: 'Payment', entityId: payment.id,
      after: { studentId: me.id, amount: d.amount, transactionCode: d.transactionCode },
    });
    refresh();

    return ok(
      `KSh ${fmt(d.amount)} submitted for checking. Your balance will not change until the office confirms it against the Till.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * Signing the rules — §5.8. Records the student, the exact version agreed to,
 * the moment, and the IP address. A record of agreement, not a legal signature
 * product, and considerably stronger than the verbal briefing it replaces.
 */
export async function signRules(prevState) {
  try {
    const me = await requireStudent();
    const rules = await prisma.hostelRules.findFirst({ where: { isCurrent: true } });
    if (!rules) return fail('There are no rules published to agree to yet.');

    const existing = await prisma.ruleAcknowledgement.findUnique({
      where: { studentId_rulesId: { studentId: me.id, rulesId: rules.id } },
    });
    if (existing) return ok('You have already agreed to this version.');

    const head = await headers();
    const ip = head.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    await prisma.ruleAcknowledgement.create({
      data: {
        studentId: me.id,
        rulesId: rules.id,
        ipAddress: ip,
        userAgent: head.get('user-agent')?.slice(0, 300) ?? null,
      },
    });

    await writeAudit(prisma, {
      action: 'RULES_SIGNED', entity: 'RuleAcknowledgement',
      after: { studentId: me.id, version: rules.version },
    });

    revalidatePath('/portal');
    revalidatePath('/portal/rules');
    revalidatePath('/admin/rules');

    return ok('Thank you — your agreement has been recorded.');
  } catch (err) {
    return fail(err.message);
  }
}

export async function changePasswordAction(prevState, formData) {
  try {
    const student = await requireStudent();
    const newPassword = String(formData.get('newPassword') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (newPassword.length < 6) {
      return fail('The password needs at least 6 characters.', {
        newPassword: 'At least 6 characters',
      });
    }
    if (newPassword !== confirmPassword) {
      return fail('The two passwords do not match.', {
        confirmPassword: 'Does not match',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.student.update({
      where: { id: student.id },
      data: { passwordHash, mustChangePassword: false },
    });

    await writeAudit(prisma, {
      action: 'STUDENT_PASSWORD_CHANGED', entity: 'Student', entityId: student.id,
    });

    revalidatePath('/portal');
    revalidatePath('/portal/ForcePasswordChange');

    return ok('Password changed. You can now use the portal.');
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * A student's notice that they are leaving — §5.7. The request snapshots the
 * balance at the moment they ask, so there is no argument later about what was
 * outstanding. It does not close anything: that is the office's decision.
 */
export async function submitVacateRequest(prevState, formData) {
  try {
    const me = await requireStudent();
    const parsed = vacateRequestSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { requestedDate, reason } = parsed.data;

    // There must be an active occupancy to vacate.
    const occupancy = await prisma.occupancy.findFirst({
      where: { studentId: me.id, status: 'ACTIVE' },
      include: { room: { select: { code: true } } },
    });
    if (!occupancy) {
      return fail('You are not in a room at the moment, so there is nothing to vacate.');
    }

    // One pending request at a time — a second is a duplicate, not a new enquiry.
    const pending = await prisma.vacateRequest.findFirst({
      where: { studentId: me.id, status: 'PENDING' },
    });
    if (pending) return fail('You already have a request being looked at.');

    // Today in Nairobi, so a past date is refused rather than silently accepted.
    const today = isoDate();
    if (requestedDate < today) {
      return fail('That date has already passed.', { requestedDate: 'Pick today or later' });
    }

    // Snapshot the balance. The latest invoice's closing balance is what they
    // owe today; before any billing it is their opening balance.
    const invoices = await prisma.invoice.findMany({
      where: { studentId: me.id },
      include: { period: { select: { year: true, month: true } } },
      orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
    });
    const latest = invoices[invoices.length - 1] ?? null;
    const balance = latest ? latest.closingBalance : me.openingBalance;

    const request = await prisma.vacateRequest.create({
      data: {
        studentId: me.id,
        occupancyId: occupancy.id,
        requestedDate: dateOnly(requestedDate),
        reason,
        balanceAtRequest: balance,
      },
    });

    await writeAudit(prisma, {
      action: 'VACATE_REQUESTED', entity: 'VacateRequest', entityId: request.id,
      after: {
        studentId: me.id, requestedDate, reason,
        balanceAtRequest: balance, roomCode: occupancy.room.code,
      },
    });

    revalidatePath('/portal/vacate');
    revalidatePath('/admin/vacate');
    revalidatePath('/admin');

    return ok(
      `Your request to leave ${occupancy.room.code} on ${requestedDate} has been sent. The office will confirm it with you.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}
