'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { settingsSchema, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

/**
 * One row, id "singleton". The Till number lives here rather than in code so
 * that changing it never needs a developer — §5.6.
 */
export async function updateSettings(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const data = parsed.data;

    const before = await prisma.settings.findUnique({ where: { id: 'singleton' } });
    const after = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'SETTINGS_UPDATED', entity: 'Settings',
      entityId: after.id, before, after,
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin');

    // The Till number is the one figure a student types into their phone, so a
    // change to it is worth saying out loud rather than a bare "Saved".
    const tillChanged = before && before.tillNumber !== after.tillNumber;
    return ok(
      tillChanged
        ? `Saved. Payments are now collected on Till ${after.tillNumber}.`
        : 'Settings saved.',
    );
  } catch (err) {
    return fail(err.message);
  }
}
