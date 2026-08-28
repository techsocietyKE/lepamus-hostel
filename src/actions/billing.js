'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireStaff, requireSuperAdmin } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { periodFor, generatePeriod } from '@/lib/billing';
import { fmt } from '@/lib/money';
import { nairobiToday } from '@/lib/dates';
import { periodSchema, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

function refresh() {
  revalidatePath('/admin/ledger');
  revalidatePath('/admin');
}

/** Open a month for billing. Idempotent — the month is unique on (year, month). */
export async function openPeriod(prevState, formData) {
  try {
    await requireStaff();
    const parsed = periodSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { year, month } = parsed.data;

    const today = nairobiToday();
    if (year * 12 + month > today.year * 12 + today.month + 1) {
      return fail('That month is too far ahead. Bill the month you are in, or the next one.');
    }

    const existed = await prisma.billingPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    const period = await periodFor(year, month);
    refresh();

    return ok(
      existed ? `${period.label} is already open.` : `${period.label} opened.`,
      { periodId: period.id },
    );
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * Generate the month's invoices — §5.4. Re-running is harmless: a student who
 * already has an invoice for the period is skipped, not billed twice.
 */
export async function generateInvoices(prevState, formData) {
  try {
    const user = await requireStaff();
    const periodId = String(formData.get('periodId') ?? '');

    const period = await prisma.billingPeriod.findUnique({ where: { id: periodId } });
    if (!period) return fail('That month is not open for billing.');
    if (period.status === 'CLOSED') {
      return fail(`${period.label} is closed. Reopen it before generating invoices.`);
    }

    const result = await generatePeriod(period);

    if (result.created === 0) {
      return ok(
        result.alreadyBilled > 0
          ? `Nothing to do — all ${result.alreadyBilled} student(s) already have an invoice for ${period.label}.`
          : `No invoices generated. Nobody is currently allocated to a room, so there is nothing to bill.`,
      );
    }

    await writeAudit(prisma, {
      userId: user.id, action: 'INVOICES_GENERATED', entity: 'BillingPeriod',
      entityId: period.id,
      after: { created: result.created, skipped: result.alreadyBilled, label: period.label },
    });
    refresh();

    const billed = result.rows.reduce((sum, r) => sum + r.rentShare, 0);
    const skipped = result.alreadyBilled > 0
      ? ` ${result.alreadyBilled} already had one and were left alone.`
      : '';
    return ok(
      `${result.created} invoice(s) generated for ${period.label}, KSh ${fmt(billed)} of rent.${skipped}`,
    );
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * Closing a month is what stops figures moving under a sheet that has already
 * been printed and agreed. Only the proprietor may do it, or undo it.
 */
export async function setPeriodStatus(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const periodId = String(formData.get('periodId') ?? '');
    const status = String(formData.get('status') ?? '');
    if (!['OPEN', 'CLOSED'].includes(status)) return fail('Unknown period status.');

    const before = await prisma.billingPeriod.findUnique({ where: { id: periodId } });
    if (!before) return fail('That month is not open for billing.');

    const after = await prisma.billingPeriod.update({
      where: { id: periodId }, data: { status },
    });
    await writeAudit(prisma, {
      userId: user.id, action: 'PERIOD_STATUS_CHANGED', entity: 'BillingPeriod',
      entityId: periodId, before, after,
    });
    refresh();
    return ok(status === 'CLOSED' ? `${after.label} closed.` : `${after.label} reopened.`);
  } catch (err) {
    return fail(err.message);
  }
}
