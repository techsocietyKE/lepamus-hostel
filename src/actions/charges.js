'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireStaff, requireSuperAdmin } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { recomputeStudent } from '@/lib/payments';
import { fmt, splitCharge } from '@/lib/money';
import { rotationFor } from '@/lib/dates';
import { chargeSchema, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

const TYPE_LABEL = {
  DAMAGE: 'Damage',
  KEY: 'Key or lock replacement',
  CLEANING: 'Cleaning',
  OTHER: 'Other',
};

function refresh(studentIds = []) {
  revalidatePath('/admin/ledger');
  revalidatePath('/admin');
  for (const id of studentIds) {
    revalidatePath(`/admin/students/${id}`);
    revalidatePath(`/admin/students/${id}/statement`);
  }
}

/**
 * A one-off charge — §5.5. Water and electricity are in the rent and are never
 * charged separately, so what is left is damage, keys, cleaning and the
 * occasional other thing.
 *
 * Charges are listed apart from rent on the invoice, the statement and the
 * sheet, so rent collection can still be reported on by itself.
 */
export async function addCharge(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = chargeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const d = parsed.data;

    const period = await prisma.billingPeriod.findUnique({ where: { id: d.periodId } });
    if (!period) return fail('That month is not open for billing.');
    if (period.status === 'CLOSED') {
      return fail(`${period.label} is closed. Reopen it before adding a charge.`);
    }

    // Charges attach to invoices, so the month has to have been generated.
    const invoices = await prisma.invoice.findMany({
      where: {
        periodId: d.periodId,
        status: { not: 'WAIVED' },
        ...(d.target === 'STUDENT' ? { studentId: d.studentId } : { roomId: d.roomId }),
      },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { student: { fullName: 'asc' } },
    });

    if (invoices.length === 0) {
      return fail(
        d.target === 'STUDENT'
          ? `That student has no invoice for ${period.label}. Generate the month first.`
          : `Nobody in that room has an invoice for ${period.label}. Generate the month first.`,
      );
    }

    // Split evenly across the room, to the shilling, summing exactly.
    const amounts = d.target === 'ROOM'
      ? splitCharge(d.amount, invoices.length, rotationFor(period.year, period.month))
      : [d.amount];

    const studentIds = invoices.map((i) => i.student.id);

    await prisma.$transaction(async (tx) => {
      await tx.otherCharge.createMany({
        data: invoices.map((inv, i) => ({
          invoiceId: inv.id,
          type: d.type,
          description: d.description,
          amount: amounts[i] ?? 0,
          createdById: user.id,
        })),
      });
      for (const studentId of studentIds) {
        await recomputeStudent(studentId, tx);
      }
    }, { timeout: 30000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'CHARGE_ADDED', entity: 'OtherCharge',
      after: {
        type: d.type, description: d.description, amount: d.amount,
        period: period.label, target: d.target, students: invoices.length,
      },
    });
    refresh(studentIds);

    return d.target === 'ROOM'
      ? ok(
        `KSh ${fmt(d.amount)} for ${TYPE_LABEL[d.type].toLowerCase()} split across ${invoices.length} student(s) — ${amounts.map((a) => fmt(a)).join(', ')}.`,
      )
      : ok(`KSh ${fmt(d.amount)} charged to ${invoices[0].student.fullName} for ${period.label}.`);
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * §5.5: a charge can be removed before it is paid. Afterwards it is reversed by
 * a credit note, so both entries stay visible rather than the record quietly
 * changing shape after money has moved against it.
 */
export async function removeCharge(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const chargeId = String(formData.get('chargeId') ?? '');

    const charge = await prisma.otherCharge.findUnique({
      where: { id: chargeId },
      include: {
        invoice: {
          include: {
            student: { select: { id: true, fullName: true } },
            period: { select: { label: true, status: true } },
          },
        },
      },
    });
    if (!charge) return fail('That charge no longer exists.');
    if (charge.invoice.period.status === 'CLOSED') {
      return fail(`${charge.invoice.period.label} is closed. Reopen it first.`);
    }
    if (charge.amount < 0) return fail('That is already a credit note.');

    const paid = charge.invoice.amountPaid > 0;

    await prisma.$transaction(async (tx) => {
      if (paid) {
        await tx.otherCharge.create({
          data: {
            invoiceId: charge.invoiceId,
            type: charge.type,
            description: `Credit note — ${charge.description}`,
            amount: -charge.amount,
            createdById: user.id,
          },
        });
      } else {
        await tx.otherCharge.delete({ where: { id: chargeId } });
      }
      await recomputeStudent(charge.invoice.studentId, tx);
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id,
      action: paid ? 'CHARGE_CREDITED' : 'CHARGE_REMOVED',
      entity: 'OtherCharge', entityId: chargeId, before: charge,
    });
    refresh([charge.invoice.studentId]);

    return ok(
      paid
        ? `Credit note raised for KSh ${fmt(charge.amount)}. Both entries stay on ${charge.invoice.student.fullName}’s statement.`
        : `Charge removed from ${charge.invoice.student.fullName}’s ${charge.invoice.period.label} invoice.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}
