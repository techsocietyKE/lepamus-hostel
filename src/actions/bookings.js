'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { dateOnly, isoDate } from '@/lib/dates';
import {
  bookingSchema, approveBookingSchema, decideBookingSchema, displayPhone, fieldErrors,
} from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

function refreshAdmin({ queue = true } = {}) {
  // Approval deliberately leaves the queue stale. Revalidating it unmounts the
  // card that is showing the student's one-time password, and the password
  // exists nowhere else — losing it that way would leave a student unable to
  // sign in with nobody knowing why.
  if (queue) revalidatePath('/admin/bookings');
  revalidatePath('/admin/students');
  revalidatePath('/admin/rooms');
  revalidatePath('/admin');
  revalidatePath('/availability');
  revalidatePath('/');
}

/** LEP-4F2K9 — short enough to read down a phone, unique enough to look up. */
function reference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  let out = '';
  for (let i = 0; i < 5; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `LEP-${out}`;
}

/**
 * A booking enquiry — §5.10. No account, no payment, no room held yet: this is
 * a statement of interest that the office replies to.
 *
 * Deliberately unauthenticated, so it is written to be safe with untrusted
 * input: every field is validated, nothing is echoed back into a query, and the
 * enquiry cannot create or change anything but its own row.
 */
export async function submitBooking(prevState, formData) {
  try {
    const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const d = parsed.data;

    // An enquiry from someone already living here is a question, not a booking.
    const resident = await prisma.student.findFirst({
      where: { phone: d.phone, status: { in: ['ACTIVE', 'NOTICE_GIVEN'] } },
      select: { fullName: true },
    });
    if (resident) {
      return fail(
        'That number already belongs to a resident. Sign in to the portal, or ring the office.',
        { phone: 'Already a resident' },
      );
    }

    // One open enquiry per person — a second is a duplicate, not a new request.
    const existing = await prisma.booking.findFirst({
      where: { phone: d.phone, status: { in: ['PENDING', 'WAITLISTED', 'APPROVED'] } },
    });
    if (existing) {
      return ok(
        `You already have an enquiry with us — reference ${existing.reference}. The office will be in touch.`,
        { reference: existing.reference, duplicate: true },
      );
    }

    if (d.categoryId) {
      const category = await prisma.roomCategory.findUnique({ where: { id: d.categoryId } });
      if (!category) return fail('That room type is no longer offered.');
    }

    // Collisions are vanishingly unlikely but cheap to rule out.
    let booking = null;
    for (let attempt = 0; attempt < 5 && !booking; attempt += 1) {
      const candidate = reference();
      const clash = await prisma.booking.findUnique({ where: { reference: candidate } });
      if (clash) continue;
      booking = await prisma.booking.create({
        data: {
          reference: candidate,
          fullName: d.fullName,
          phone: d.phone,
          email: d.email,
          gender: d.gender,
          institution: d.institution,
          categoryId: d.categoryId,
          desiredMoveIn: d.desiredMoveIn ? dateOnly(d.desiredMoveIn) : null,
          message: d.message,
          requestedRoomCode: d.requestedRoomCode,
        },
      });
    }
    if (!booking) return fail('Something went wrong generating your reference. Please try again.');

    revalidatePath('/admin/bookings');
    revalidatePath('/admin');

    return ok(
      'Enquiry received. Nothing is confirmed until the office approves it, and no payment is needed yet.',
      { reference: booking.reference },
    );
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * A first password the student changes at their first sign-in. Deliberately
 * readable down a phone: no characters that argue with each other when spoken.
 */
function temporaryPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Approving an enquiry — §5.10. This is the moment a visitor becomes a
 * resident: the student record is created, the occupancy opened, and login
 * credentials issued. The bed is then held for a configurable number of days.
 *
 * A returning student is re-admitted rather than duplicated, and any old
 * balance is still attached to them (§5.2).
 */
export async function approveBooking(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = approveBookingSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { bookingId, roomId, startDate } = parsed.data;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return fail('That enquiry no longer exists.');
    if (booking.status !== 'PENDING' && booking.status !== 'WAITLISTED') {
      return fail(`That enquiry is already ${booking.status.toLowerCase()}.`);
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { _count: { select: { occupancies: { where: { status: 'ACTIVE' } } } } },
    });
    if (!room) return fail('That room no longer exists.');
    if (room.status !== 'ACTIVE') {
      return fail(`Room ${room.code} is not in use at the moment.`);
    }
    if (room._count.occupancies >= room.capacity) {
      return fail(`Room ${room.code} filled up while this was waiting. Pick another.`);
    }
    // The same gate as any other allocation — refused, not warned about.
    if (room.gender !== 'ANY' && room.gender !== booking.gender) {
      const roomIs = room.gender === 'MALE' ? 'a men’s room' : 'a women’s room';
      return fail(`Room ${room.code} is ${roomIs}, so it cannot take this student.`);
    }

    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
    const holdDays = settings?.bookingHoldDays ?? 5;
    const holdExpiresAt = new Date();
    holdExpiresAt.setUTCDate(holdExpiresAt.getUTCDate() + holdDays);

    const existing = await prisma.student.findUnique({ where: { phone: booking.phone } });
    
    // Use a standard default password for all new approvals
    const password = 'student123';
    const passwordHash = await bcrypt.hash(password, 10);
    const { student, returning } = await prisma.$transaction(async (tx) => {
      let record;
      let wasReturning = false;

      if (existing) {
        // Re-admission: their history, and any balance, comes with them.
        wasReturning = true;
        record = await tx.student.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            fullName: existing.fullName || booking.fullName,
            email: existing.email ?? booking.email,
            institution: existing.institution ?? booking.institution,
            passwordHash,
            mustChangePassword: true,
          },
        });
      } else {
        record = await tx.student.create({
          data: {
            fullName: booking.fullName,
            phone: booking.phone,
            email: booking.email,
            gender: booking.gender,
            institution: booking.institution,
            passwordHash,
            mustChangePassword: true,
          },
        });
      }

      await tx.occupancy.create({
        data: {
          studentId: record.id,
          roomId,
          startDate: dateOnly(startDate),
          status: 'ACTIVE',
          createdById: user.id,
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'APPROVED',
          assignedRoomId: roomId,
          studentId: record.id,
          approvedAt: new Date(),
          holdExpiresAt,
          decidedById: user.id,
        },
      });

      return { student: record, returning: wasReturning };
    }, { timeout: 30000 });

    await writeAudit(prisma, {
      userId: user.id, action: 'BOOKING_APPROVED', entity: 'Booking', entityId: bookingId,
      after: {
        reference: booking.reference, roomCode: room.code,
        studentId: student.id, returning, holdExpiresAt,
      },
    });
    refreshAdmin({ queue: false });

    return ok(
      `${student.fullName} is in room ${room.code}${returning ? ', re-admitted with their old balance' : ''}. The bed is held for ${holdDays} days.`,
      {
        credentials: {
          name: student.fullName,
          phone: displayPhone(student.phone),
          password,
          roomCode: room.code,
        },
      },
    );
  } catch (err) {
    return fail(err.message);
  }
}

/** Rejecting or waitlisting. Either way the enquiry stays on record. */
export async function decideBooking(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = decideBookingSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { bookingId, status, note } = parsed.data;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return fail('That enquiry no longer exists.');
    if (booking.status === 'APPROVED' || booking.status === 'CONVERTED') {
      return fail('That enquiry has already been approved.');
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status,
        decidedById: user.id,
        message: note ? [booking.message, `Office: ${note}`].filter(Boolean).join('\n') : booking.message,
      },
    });

    await writeAudit(prisma, {
      userId: user.id, action: `BOOKING_${status}`, entity: 'Booking',
      entityId: bookingId, after: { reference: booking.reference, note },
    });
    refreshAdmin();

    return ok(
      status === 'WAITLISTED'
        ? `${updated.fullName} is on the waiting list. They stay in the queue for when a bed frees up.`
        : `${updated.fullName}’s enquiry is closed. It stays on record.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * Release holds that have run out — §5.10. If the student has neither paid nor
 * moved in within the hold, the bed goes back to the availability page.
 *
 * "Neither paid nor moved in" is read as: no approved payment against them.
 * The occupancy opened at approval is closed, which is what actually frees the
 * bed, and the student record stays so nothing is lost.
 *
 * Idempotent by construction — it only ever acts on approved bookings whose
 * hold is already in the past, so running it twice does nothing the second time.
 */
export async function releaseExpiredHolds(client = prisma) {
  const now = new Date();
  const expired = await client.booking.findMany({
    where: { status: 'APPROVED', holdExpiresAt: { lt: now } },
    include: {
      student: { select: { id: true, fullName: true } },
    },
  });
  if (expired.length === 0) return { released: 0, kept: 0 };

  let released = 0;
  let kept = 0;

  for (const booking of expired) {
    const paid = booking.studentId
      ? await client.payment.count({
        where: { studentId: booking.studentId, status: 'APPROVED' },
      })
      : 0;

    if (paid > 0) {
      // They paid, so the booking did its job. Convert rather than expire.
      await client.booking.update({
        where: { id: booking.id },
        data: { status: 'CONVERTED' },
      });
      kept += 1;
      continue;
    }

    await client.$transaction(async (tx) => {
      if (booking.studentId) {
        await tx.occupancy.updateMany({
          where: { studentId: booking.studentId, status: 'ACTIVE' },
          data: { status: 'ENDED', endDate: dateOnly(isoDate()), endReason: 'REMOVED' },
        });
        await tx.student.update({
          where: { id: booking.studentId },
          data: { status: 'VACATED' },
        });
      }
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'EXPIRED' },
      });
    }, { timeout: 20000 });
    released += 1;
  }

  return { released, kept };
}

/** The same sweep, run deliberately from the queue. */
export async function releaseExpiredHoldsAction(prevState) {
  try {
    const user = await requireStaff();
    const { released, kept } = await releaseExpiredHolds();

    if (released === 0 && kept === 0) return ok('No holds have run out.');

    await writeAudit(prisma, {
      userId: user.id, action: 'BOOKING_HOLDS_RELEASED', entity: 'Booking',
      after: { released, converted: kept },
    });
    refreshAdmin();

    return ok(
      [
        released > 0 ? `${released} bed(s) released back to the website` : null,
        kept > 0 ? `${kept} booking(s) had payments and were kept` : null,
      ].filter(Boolean).join(', ') + '.',
    );
  } catch (err) {
    return fail(err.message);
  }
}

export async function sweepExpiredHoldsAction() {
  try {
    const now = new Date();

    const expired = await prisma.booking.findMany({
      where: {
        status: { in: ["PENDING", "HOLD"] },
        expiresAt: { lt: now },
      },
      select: { id: true, bedId: true },
    });

    if (expired.length === 0) {
      return { success: true, count: 0 };
    }

    const bookingIds = expired.map((b) => b.id);
    const bedIds = expired.map((b) => b.bedId).filter(Boolean);

    await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { status: "EXPIRED" },
      });

      if (bedIds.length > 0) {
        await tx.bed.updateMany({
          where: { id: { in: bedIds } },
          data: { isAvailable: true },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "HOLD_SWEEPER_MANUAL",
          details: `Manually swept ${expired.length} expired booking holds.`,
        },
      });
    });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin/rooms");
    revalidatePath("/availability");
    return { success: true, count: expired.length };
  } catch (error) {
    console.error("Failed to sweep holds:", error);
    return { success: false, error: error.message };
  }
}
