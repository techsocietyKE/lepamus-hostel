'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { requireStudent } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { fmt } from '@/lib/money';
import { dateOnly, isoDate } from '@/lib/dates';
import { submitPaymentSchema, fieldErrors } from '@/lib/validation';

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
