'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireStaff, requireSuperAdmin } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { applyPayment, nextReceiptNumber, recomputeStudent } from '@/lib/payments';
import { fmt } from '@/lib/money';
import { dateOnly, isoDate } from '@/lib/dates';
import {
  cashPaymentSchema, tillPaymentSchema, approveSchema, rejectSchema, fieldErrors,
} from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

function refresh(studentId) {
  revalidatePath('/admin/ledger');
  revalidatePath('/admin/payments');
  revalidatePath('/admin');
  if (studentId) {
    revalidatePath(`/admin/students/${studentId}`);
    // Nested routes are not covered by revalidating the parent.
    revalidatePath(`/admin/students/${studentId}/statement`);
  }
}

/** Postgres unique-violation, surfaced as the thing the clerk needs to hear. */
function duplicateCodeMessage(err, code) {
  if (err?.code === 'P2002' && String(err?.meta?.target ?? '').includes('transactionCode')) {
    return `${code} has already been recorded. The same M-Pesa payment cannot be entered twice.`;
  }
  return null;
}

/**
 * Cash over the counter. The clerk is holding the money, so it is approved at
 * the moment it is recorded — there is nothing left to verify. M-Pesa is the
 * case that needs a queue, and that is a separate action.
 */
export async function recordCashPayment(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = cashPaymentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the amount.', fieldErrors(parsed.error));
    const d = parsed.data;

    const student = await prisma.student.findUnique({
      where: { id: d.studentId },
      select: { id: true, fullName: true },
    });
    if (!student) return fail('That student is no longer on file.');

    const paidAt = dateOnly(d.paidAt ?? isoDate());
    const now = new Date();

    const { payment, result } = await prisma.$transaction(async (tx) => {
      const receiptNo = await nextReceiptNumber(tx);
      const created = await tx.payment.create({
        data: {
          receiptNo,
          studentId: d.studentId,
          amount: d.amount,
          method: 'CASH',
          status: 'APPROVED',
          paidAt,
          decidedAt: now,
          decidedById: user.id,
          recordedById: user.id,
          note: d.note,
        },
      });
      const applied = await applyPayment(created.id, d.studentId, tx);
      return { payment: created, result: applied };
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'CASH_PAYMENT_RECORDED', entity: 'Payment',
      entityId: payment.id,
      after: {
        receiptNo: payment.receiptNo, studentId: d.studentId,
        amount: d.amount, invoicesTouched: result.updated,
      },
    });
    refresh(d.studentId);

    const credit = result.closingBalance < 0
      ? ` ${student.fullName} is now KSh ${fmt(-result.closingBalance)} in credit.`
      : '';
    const unbilled = result.unbilled
      ? ' Nothing is billed yet, so it is held until the next invoice is generated.'
      : '';

    return ok(
      `Receipt ${payment.receiptNo} — KSh ${fmt(d.amount)} from ${student.fullName}.${credit}${unbilled}`,
    );
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * A Till payment entered by the office — §5.6. The administrator can record and
 * approve one directly, without waiting for the student to submit anything.
 * Submission speeds the office up; it is not a requirement.
 */
export async function recordTillPayment(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = tillPaymentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const d = parsed.data;

    const student = await prisma.student.findUnique({
      where: { id: d.studentId },
      select: { id: true, fullName: true },
    });
    if (!student) return fail('That student is no longer on file.');

    const clash = await prisma.payment.findUnique({
      where: { transactionCode: d.transactionCode },
      include: { student: { select: { fullName: true } } },
    });
    if (clash) {
      return fail(
        `${d.transactionCode} was already recorded against ${clash.student.fullName}.`,
        { transactionCode: 'Already used' },
      );
    }

    const now = new Date();
    const { payment, result } = await prisma.$transaction(async (tx) => {
      const receiptNo = await nextReceiptNumber(tx);
      const created = await tx.payment.create({
        data: {
          receiptNo,
          studentId: d.studentId,
          amount: d.amount,
          amountClaimed: d.amount,
          method: 'MPESA_TILL',
          status: 'APPROVED',
          transactionCode: d.transactionCode,
          payerPhone: d.payerPhone,
          paidAt: dateOnly(d.paidAt),
          decidedAt: now,
          decidedById: user.id,
          recordedById: user.id,
          note: d.note,
        },
      });
      const applied = await applyPayment(created.id, d.studentId, tx);
      return { payment: created, result: applied };
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'TILL_PAYMENT_RECORDED', entity: 'Payment',
      entityId: payment.id,
      after: {
        receiptNo: payment.receiptNo, transactionCode: d.transactionCode,
        studentId: d.studentId, amount: d.amount,
      },
    });
    refresh(d.studentId);

    const credit = result.closingBalance < 0
      ? ` ${student.fullName} is now KSh ${fmt(-result.closingBalance)} in credit.`
      : '';
    return ok(
      `Receipt ${payment.receiptNo} — KSh ${fmt(d.amount)} from ${student.fullName}, code ${d.transactionCode}.${credit}`,
    );
  } catch (err) {
    return fail(duplicateCodeMessage(err, String(formData.get('transactionCode') ?? '')) ?? err.message);
  }
}

/**
 * Approve a submitted claim. This is the moment money moves: until now the
 * claim has been visible to both sides and has changed nothing.
 *
 * The amount is editable, because what arrived at the Till is the truth and
 * what the student typed is only a claim.
 */
export async function approvePayment(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = approveSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the amount.', fieldErrors(parsed.error));
    const { paymentId, amount } = parsed.data;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (!payment) return fail('That payment no longer exists.');
    if (payment.status !== 'SUBMITTED') {
      return fail(`That payment is already ${payment.status.toLowerCase()}.`);
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const receiptNo = payment.receiptNo ?? await nextReceiptNumber(tx);
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          receiptNo, amount, status: 'APPROVED',
          decidedAt: now, decidedById: user.id,
        },
      });
      return applyPayment(paymentId, payment.studentId, tx);
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'PAYMENT_APPROVED', entity: 'Payment', entityId: paymentId,
      before: { status: 'SUBMITTED', amountClaimed: payment.amountClaimed },
      after: { status: 'APPROVED', amount },
    });
    refresh(payment.studentId);

    const adjusted = payment.amountClaimed !== null && payment.amountClaimed !== amount
      ? ` Claimed KSh ${fmt(payment.amountClaimed)}, approved KSh ${fmt(amount)}.`
      : '';
    return ok(`Approved for ${payment.student.fullName}.${adjusted}`);
  } catch (err) {
    return fail(err.message);
  }
}

/** Rejection needs a reason, because the student is shown it. */
export async function rejectPayment(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('A reason is required.', fieldErrors(parsed.error));
    const { paymentId, reason } = parsed.data;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (!payment) return fail('That payment no longer exists.');
    if (payment.status !== 'SUBMITTED') {
      return fail(`That payment is already ${payment.status.toLowerCase()}.`);
    }

    // The claim stays on record rather than disappearing.
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REJECTED', rejectionReason: reason,
        decidedAt: new Date(), decidedById: user.id,
      },
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'PAYMENT_REJECTED', entity: 'Payment',
      entityId: paymentId, after: { reason },
    });
    refresh(payment.studentId);
    return ok(`Rejected. ${payment.student.fullName} will see the reason.`);
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * Working down eighty claims one at a time in the first week of the month would
 * be tedious, so a set checked against the Till can be approved together. Each
 * is applied on its own, so one failure does not lose the rest.
 */
export async function bulkApprovePayments(prevState, formData) {
  try {
    const user = await requireStaff();
    const ids = formData.getAll('paymentIds').map(String).filter(Boolean);
    if (ids.length === 0) return fail('Tick the payments you have checked against the Till.');

    const payments = await prisma.payment.findMany({
      where: { id: { in: ids }, status: 'SUBMITTED' },
    });
    if (payments.length === 0) return fail('None of those are still awaiting a decision.');

    const now = new Date();
    let approved = 0;
    const failures = [];

    for (const p of payments) {
      try {
        await prisma.$transaction(async (tx) => {
          const receiptNo = p.receiptNo ?? await nextReceiptNumber(tx);
          await tx.payment.update({
            where: { id: p.id },
            data: { receiptNo, status: 'APPROVED', decidedAt: now, decidedById: user.id },
          });
          await applyPayment(p.id, p.studentId, tx);
        }, { timeout: 20000 });
        approved += 1;
      } catch (err) {
        failures.push(err.message);
      }
    }

    await writeAudit(prisma, {
      userId: user.id, action: 'PAYMENTS_BULK_APPROVED', entity: 'Payment',
      after: { approved, attempted: payments.length },
    });
    refresh();

    if (failures.length > 0) {
      return fail(`${approved} approved, ${failures.length} failed. First problem: ${failures[0]}`);
    }
    return ok(`${approved} payment(s) approved.`);
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * §5.6: payments are never edited. A wrong one is reversed and re-entered, and
 * both entries stay visible so the correction is part of the record.
 */
export async function reversePayment(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const paymentId = String(formData.get('paymentId') ?? '');
    const reason = String(formData.get('reason') ?? '').trim();
    if (!reason) return fail('Give a reason for the reversal.', { reason: 'Required' });

    const original = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (!original) return fail('That payment no longer exists.');
    if (original.status === 'REVERSED') return fail('That payment has already been reversed.');
    if (original.status !== 'APPROVED') {
      return fail('Only an approved payment needs reversing. Reject it instead.');
    }

    await prisma.$transaction(async (tx) => {
      // Removing the allocations is what returns the money to the invoices.
      await tx.paymentAllocation.deleteMany({ where: { paymentId } });
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'REVERSED', note: [original.note, `Reversed: ${reason}`].filter(Boolean).join(' — ') },
      });
      await recomputeStudent(original.studentId, tx);
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'PAYMENT_REVERSED', entity: 'Payment',
      entityId: paymentId, before: original, after: { reason },
    });
    refresh(original.studentId);

    return ok(
      `Receipt ${original.receiptNo ?? ''} reversed. ${original.student.fullName}’s balance has been put back.`.trim(),
    );
  } catch (err) {
    return fail(err.message);
  }
}
