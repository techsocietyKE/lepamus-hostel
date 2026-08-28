'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { recomputeStudent } from '@/lib/payments';
import { reliefDiscount, reliefForMonth } from '@/lib/billing';
import { fmt } from '@/lib/money';
import { monthLabel } from '@/lib/dates';
import { reliefSchema, adjustInvoiceSchema, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

function refresh(studentId) {
  revalidatePath('/admin/ledger');
  revalidatePath('/admin/students');
  if (studentId) {
    revalidatePath(`/admin/students/${studentId}`);
    // The statement is a nested route and is NOT covered by revalidating its
    // parent — without this the figures change in the database while the screen
    // that was just used to change them goes on showing the old ones.
    revalidatePath(`/admin/students/${studentId}/statement`);
  }
}

/**
 * Rewrite the discount on invoices already generated inside a relief period.
 *
 * Rule 2 freezes the rent share and the occupant count, not the discount: a
 * placement agreed on the 20th is meant to apply to the month it covers, and
 * the proprietor would otherwise have to remember to adjust each invoice by
 * hand — which is the manual step this record exists to remove.
 */
async function applyReliefToExistingInvoices(studentId, client) {
  const [reliefs, invoices] = await Promise.all([
    client.rentRelief.findMany({ where: { studentId, cancelledAt: null } }),
    client.invoice.findMany({
      where: { studentId, status: { not: 'WAIVED' } },
      include: { period: { select: { year: true, month: true } } },
    }),
  ]);

  let touched = 0;
  for (const inv of invoices) {
    const relief = reliefForMonth(reliefs, inv.period.year, inv.period.month);
    const discount = relief ? reliefDiscount(inv.rentShare, relief.payPercent) : 0;
    const reason = relief ? `${relief.reason} — pays ${relief.payPercent}% of the share` : null;
    if (inv.discount === discount && inv.discountReason === reason) continue;
    await client.invoice.update({
      where: { id: inv.id },
      data: { discount, discountReason: reason },
    });
    touched += 1;
  }
  return touched;
}

/**
 * A run of months at a reduced share — placement, attachment, or a negotiated
 * arrangement. Only the proprietor decides these, because they are agreed
 * personally and vary from student to student.
 */
export async function grantRelief(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const parsed = reliefSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const d = parsed.data;

    const student = await prisma.student.findUnique({
      where: { id: d.studentId },
      select: { id: true, fullName: true },
    });
    if (!student) return fail('That student is no longer on file.');

    const relief = await prisma.rentRelief.create({
      data: { ...d, approvedById: user.id },
    });

    const touched = await prisma.$transaction(async (tx) => {
      const n = await applyReliefToExistingInvoices(d.studentId, tx);
      await recomputeStudent(d.studentId, tx);
      return n;
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'RELIEF_GRANTED', entity: 'RentRelief',
      entityId: relief.id, after: { ...relief, studentName: student.fullName },
    });
    refresh(d.studentId);

    const from = monthLabel(d.startYear, d.startMonth);
    const to = monthLabel(d.endYear, d.endMonth);
    const span = from === to ? from : `${from} to ${to}`;
    const applied = touched > 0
      ? ` ${touched} invoice(s) already generated were adjusted.`
      : ' It will apply when those months are generated.';

    return ok(
      `${student.fullName} pays ${d.payPercent}% of their share for ${span}.${applied}`,
    );
  } catch (err) {
    return fail(err.message);
  }
}

/** Cancelling puts the full share back and re-corrects any month it touched. */
export async function cancelRelief(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const id = String(formData.get('reliefId') ?? '');

    const relief = await prisma.rentRelief.findUnique({
      where: { id },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (!relief) return fail('That arrangement no longer exists.');
    if (relief.cancelledAt) return fail('That arrangement is already cancelled.');

    await prisma.rentRelief.update({
      where: { id },
      data: { cancelledAt: new Date(), cancelledById: user.id },
    });

    const touched = await prisma.$transaction(async (tx) => {
      const n = await applyReliefToExistingInvoices(relief.studentId, tx);
      await recomputeStudent(relief.studentId, tx);
      return n;
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'RELIEF_CANCELLED', entity: 'RentRelief',
      entityId: id, before: relief,
    });
    refresh(relief.studentId);

    return ok(
      `Cancelled. ${relief.student.fullName} is back to the full share${touched > 0 ? `, and ${touched} invoice(s) were put back` : ''}.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * A one-off reduction on a single invoice — "pay less this month", agreed at
 * the counter. Distinct from relief: it covers one month and is not repeated.
 */
export async function adjustInvoice(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const parsed = adjustInvoiceSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { invoiceId, discount, reason } = parsed.data;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: { select: { id: true, fullName: true } },
        period: { select: { year: true, month: true, label: true, status: true } },
      },
    });
    if (!invoice) return fail('That invoice no longer exists.');
    if (invoice.status === 'WAIVED') return fail('That invoice has been waived already.');
    if (invoice.period.status === 'CLOSED') {
      return fail(`${invoice.period.label} is closed. Reopen it before changing a figure.`);
    }
    if (discount > invoice.rentShare + invoice.chargesTotal) {
      return fail(
        `A discount of KSh ${fmt(discount)} is more than the ${fmt(invoice.rentShare + invoice.chargesTotal)} being charged this month.`,
        { discount: 'More than the charge' },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          discount,
          discountReason: reason,
          adjustedById: user.id,
          adjustmentNote: `${reason} (set by ${user.name})`,
        },
      });
      await recomputeStudent(invoice.studentId, tx);
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'INVOICE_DISCOUNTED', entity: 'Invoice', entityId: invoiceId,
      before: { discount: invoice.discount, discountReason: invoice.discountReason },
      after: { discount, discountReason: reason },
    });
    refresh(invoice.studentId);

    return discount === 0
      ? ok(`Discount removed from ${invoice.student.fullName}’s ${invoice.period.label} invoice.`)
      : ok(
        `${invoice.student.fullName} pays KSh ${fmt(discount)} less for ${invoice.period.label}. The reason is on the invoice and in the audit log.`,
      );
  } catch (err) {
    return fail(err.message);
  }
}
