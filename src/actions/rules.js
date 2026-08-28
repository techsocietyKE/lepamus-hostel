'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { rulesSchema, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

/**
 * Publishing a new version of the rules — §5.8.
 *
 * Versions are never edited in place. Old ones stay on record because the
 * acknowledgements point at them: a student agreed to a particular text on a
 * particular day, and rewriting that text afterwards would quietly change what
 * they are recorded as having agreed to.
 */
export async function publishRules(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const parsed = rulesSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { title, content } = parsed.data;

    const current = await prisma.hostelRules.findFirst({ where: { isCurrent: true } });
    if (current && current.title === title && current.content === content) {
      return fail('Nothing has changed, so there is no new version to publish.');
    }

    const latest = await prisma.hostelRules.findFirst({ orderBy: { version: 'desc' } });
    const version = (latest?.version ?? 0) + 1;

    const published = await prisma.$transaction(async (tx) => {
      await tx.hostelRules.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.hostelRules.create({
        data: { version, title, content, isCurrent: true, publishedBy: user.name },
      });
    }, { timeout: 20000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'RULES_PUBLISHED', entity: 'HostelRules',
      entityId: published.id, after: { version, title },
    });

    revalidatePath('/admin/rules');
    revalidatePath('/rules');
    revalidatePath('/');

    return ok(
      version === 1
        ? 'The rules are published and now readable on the website.'
        : `Version ${version} published. Every resident will be asked to sign it again at their next login, and the old acknowledgements stay on record.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}
