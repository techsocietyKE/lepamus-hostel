'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { formatDate } from '@/lib/dates';
import { decideVacateSchema, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

function refresh(studentId) {
  revalidatePath('/admin/vacate');
  revalidatePath('/admin/students');
  revalidatePath('/admin');
  if (studentId) {
    revalidatePath(`/admin/students/${studentId}`);
    revalidatePath(`/admin/students/${studentId}/statement`);
  }
}

/**
 * The office's answer to a student's notice to leave — §5.7.
 *
 * Approving is the moment the bed frees: the occupancy is closed on the
 * requested date, the student is marked vacated, and their history stays
 * attached. Rejecting leaves everything as it is and the student sees the note.
 * Either way the request stays on record.
 */
export async function decideVacateRequest(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = decideVacateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { vacateId, decision, adminNotes } = parsed.data;

    const request = await prisma.vacateRequest.findUnique({
      where: { id: vacateId },
      include: {
        student: { select: { id: true, fullName: true, phone: true } },
        occupancy: { include: { room: { select: { code: true } } } },
      },
    });
    if (!request) return fail('That request no longer exists.');
    if (request.status !== 'PENDING') {
      return fail(`That request is already ${request.status.toLowerCase()}.`);
    }

    if (decision === 'APPROVED') {
      await prisma.$transaction(async (tx) => {
        // Close the occupancy and free the bed. The end date is what the
        // student asked for, so the room's availability page is right.
        await tx.occupancy.update({
          where: { id: request.occupancyId },
          data: { status: 'ENDED', endReason: 'VACATED', endDate: request.requestedDate },
        });
        await tx.student.update({
          where: { id: request.studentId },
          data: { status: 'VACATED' },
        });
        await tx.vacateRequest.update({
          where: { id: vacateId },
          data: {
            status: 'APPROVED',
            decidedById: user.id,
            decidedAt: new Date(),
            adminNotes,
          },
        });
      }, { timeout: 20000 });

      await writeAudit(prisma, {
        userId: user.id, action: 'VACATE_APPROVED', entity: 'VacateRequest',
        entityId: vacateId,
        before: { status: 'PENDING', balanceAtRequest: request.balanceAtRequest },
        after: {
          status: 'APPROVED', requestedDate: request.requestedDate,
          roomCode: request.occupancy.room.code, adminNotes,
        },
      });
      refresh(request.studentId);

      return ok(
        `${request.student.fullName} was approved to leave ${request.occupancy.room.code} on ${formatDate(request.requestedDate)}. The bed is free.`,
      );
    }

    // REJECTED — the student stays put and sees the note.
    await prisma.vacateRequest.update({
      where: { id: vacateId },
      data: {
        status: 'REJECTED',
        decidedById: user.id,
        decidedAt: new Date(),
        adminNotes,
      },
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'VACATE_REJECTED', entity: 'VacateRequest',
      entityId: vacateId,
      before: { status: 'PENDING' }, after: { status: 'REJECTED', adminNotes },
    });
    refresh(request.studentId);

    return ok(
      `${request.student.fullName}’s request was declined.${adminNotes ? ` They will see: ${adminNotes}` : ''}`,
    );
  } catch (err) {
    return fail(err.message);
  }
}
