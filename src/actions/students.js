'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireStaff, requireSuperAdmin } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { canAllocate } from '@/lib/occupancy';
import { dateOnly, isoDate } from '@/lib/dates';
import bcrypt from 'bcryptjs';
import { studentSchema, allocateSchema, displayPhone, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

function refresh(id) {
  revalidatePath('/admin/students');
  revalidatePath('/admin/rooms');
  revalidatePath('/admin');
  if (id) revalidatePath(`/admin/students/${id}`);
}

/**
 * A fresh sign-in password, shown once. There is no way to read the old one —
 * it is stored only as a hash — so "they lost it" and "we never wrote it down"
 * have the same answer, and it needs to be a cheap one.
 */
export async function resetStudentPassword(prevState, formData) {
  try {
    const user = await requireStaff();
    const id = String(formData.get('studentId') ?? '');

    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, fullName: true, phone: true },
    });
    if (!student) return fail('That student is no longer on file.');

    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i += 1) {
      password += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    await prisma.student.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'STUDENT_PASSWORD_RESET', entity: 'Student', entityId: id,
    });
    refresh(id);

    return ok(`New password for ${student.fullName}.`, {
      credentials: { phone: displayPhone(student.phone), password },
    });
  } catch (err) {
    return fail(err.message);
  }
}

export async function createStudent(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = studentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const d = parsed.data;

    const clash = await prisma.student.findFirst({
      where: { OR: [{ phone: d.phone }, d.email ? { email: d.email } : undefined].filter(Boolean) },
    });
    if (clash) {
      const which = clash.phone === d.phone ? 'phone' : 'email';
      return fail(
        `${clash.fullName} is already on file with that ${which}.`,
        { [which]: 'Already in use' },
      );
    }

    const student = await prisma.student.create({
      data: {
        fullName: d.fullName,
        phone: d.phone,
        email: d.email,
        gender: d.gender,
        idNumber: d.idNumber,
        institution: d.institution,
        course: d.course,
        nextOfKinName: d.nextOfKinName,
        nextOfKinPhone: d.nextOfKinPhone,
        openingBalance: d.openingBalance,
        admittedAt: d.admittedAt ? dateOnly(d.admittedAt) : new Date(),
      },
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'STUDENT_CREATED', entity: 'Student',
      entityId: student.id, after: { ...student, passwordHash: undefined },
    });
    refresh(student.id);
    return ok(`${student.fullName} added.`, { studentId: student.id });
  } catch (err) {
    return fail(err.message);
  }
}

export async function updateStudent(prevState, formData) {
  try {
    const user = await requireStaff();
    const id = String(formData.get('id') ?? '');
    const parsed = studentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const d = parsed.data;

    const before = await prisma.student.findUnique({ where: { id } });
    if (!before) return fail('That student is no longer on file.');

    if (d.phone !== before.phone) {
      const clash = await prisma.student.findUnique({ where: { phone: d.phone } });
      if (clash) return fail('Another student already has that phone number.', { phone: 'Already in use' });
    }
    if (d.email && d.email !== before.email) {
      const clash = await prisma.student.findUnique({ where: { email: d.email } });
      if (clash) return fail('Another student already has that email.', { email: 'Already in use' });
    }

    /**
     * The opening balance only ever feeds the FIRST invoice. Once one exists,
     * editing it would change a figure nothing reads while appearing to correct
     * the student's position — so it is frozen and the correction belongs on
     * the invoice instead.
     */
    const invoiced = await prisma.invoice.count({ where: { studentId: id } });
    if (invoiced > 0 && d.openingBalance !== before.openingBalance) {
      return fail(
        `${before.fullName} has already been invoiced, so the opening balance is fixed. Adjust the invoice instead.`,
        { openingBalance: 'Fixed once billing has started' },
      );
    }

    const after = await prisma.student.update({
      where: { id },
      data: {
        fullName: d.fullName,
        phone: d.phone,
        email: d.email,
        gender: d.gender,
        idNumber: d.idNumber,
        institution: d.institution,
        course: d.course,
        nextOfKinName: d.nextOfKinName,
        nextOfKinPhone: d.nextOfKinPhone,
        ...(invoiced === 0 ? { openingBalance: d.openingBalance } : {}),
        admittedAt: d.admittedAt ? dateOnly(d.admittedAt) : before.admittedAt,
      },
    });

    await writeAudit(prisma, {
      userId: user.id,
      action: d.phone !== before.phone ? 'STUDENT_PHONE_CHANGED' : 'STUDENT_UPDATED',
      entity: 'Student', entityId: id,
      before: { ...before, passwordHash: undefined },
      after: { ...after, passwordHash: undefined },
    });
    refresh(id);
    return ok('Saved.');
  } catch (err) {
    return fail(err.message);
  }
}

export async function setStudentStatus(prevState, formData) {
  try {
    const user = await requireStaff();
    const id = String(formData.get('id') ?? '');
    const status = String(formData.get('status') ?? '');
    if (!['ACTIVE', 'NOTICE_GIVEN', 'VACATED', 'BLACKLISTED'].includes(status)) {
      return fail('Unknown status.');
    }
    const before = await prisma.student.findUnique({ where: { id } });
    if (!before) return fail('That student is no longer on file.');

    const after = await prisma.student.update({ where: { id }, data: { status } });
    await writeAudit(prisma, {
      userId: user.id, action: 'STUDENT_STATUS_CHANGED', entity: 'Student', entityId: id,
      before: { status: before.status }, after: { status },
    });
    refresh(id);
    return ok('Status updated.');
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * Put a student in a room. Every allocation goes through canAllocate, which
 * refuses on gender and capacity rather than warning. The proprietor can
 * override, and the override is recorded with its reason.
 */
export async function allocateRoom(prevState, formData) {
  try {
    const user = await requireStaff();
    const raw = Object.fromEntries(formData);
    const parsed = allocateSchema.safeParse({ ...raw, override: raw.override === 'on' || raw.override === 'true' });
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { studentId, roomId, startDate, override, overrideReason } = parsed.data;

    const gate = await canAllocate(studentId, roomId);

    if (!gate.ok) {
      if (!(override && gate.overridable)) {
        return fail(gate.reason, { roomId: gate.reason });
      }
      if (user.role !== 'SUPER_ADMIN') {
        return fail(`${gate.reason} Only the proprietor can override this.`);
      }
      if (!overrideReason) {
        return fail('Give a reason for the override — it goes on the record.', {
          overrideReason: 'Required for an override',
        });
      }
    }

    const occupancy = await prisma.occupancy.create({
      data: {
        studentId,
        roomId,
        startDate: dateOnly(startDate) ?? dateOnly(isoDate()),
        status: 'ACTIVE',
        createdById: user.id,
      },
      include: { room: true, student: true },
    });

    await writeAudit(prisma, {
      userId: user.id,
      action: gate.ok ? 'OCCUPANCY_OPENED' : 'OCCUPANCY_OPENED_OVERRIDE',
      entity: 'Occupancy', entityId: occupancy.id,
      after: {
        student: occupancy.student.fullName,
        room: occupancy.room.code,
        startDate: occupancy.startDate,
        overrideReason: gate.ok ? undefined : overrideReason,
        overrodeRule: gate.ok ? undefined : gate.code,
      },
    });

    refresh(studentId);
    revalidatePath(`/admin/rooms/${roomId}`);
    return ok(`${occupancy.student.fullName} is in room ${occupancy.room.code}.`);
  } catch (err) {
    return fail(err.message);
  }
}

/** Close an occupancy. The financial history stays attached to the student. */
export async function endOccupancy(prevState, formData) {
  try {
    const user = await requireStaff();
    const id = String(formData.get('occupancyId') ?? '');
    const reason = String(formData.get('endReason') ?? 'VACATED');
    const endDate = String(formData.get('endDate') ?? '') || isoDate();

    const occupancy = await prisma.occupancy.findUnique({
      where: { id },
      include: { room: true, student: true },
    });
    if (!occupancy) return fail('That record no longer exists.');
    if (occupancy.status !== 'ACTIVE') return fail('That occupancy is already closed.');

    await prisma.$transaction(async (tx) => {
      await tx.occupancy.update({
        where: { id },
        data: { status: 'ENDED', endReason: reason, endDate: dateOnly(endDate) },
      });
      if (reason === 'VACATED' || reason === 'REMOVED') {
        await tx.student.update({ where: { id: occupancy.studentId }, data: { status: 'VACATED' } });
      }
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'OCCUPANCY_CLOSED', entity: 'Occupancy', entityId: id,
      before: { status: 'ACTIVE' },
      after: { status: 'ENDED', endReason: reason, endDate, room: occupancy.room.code },
    });

    refresh(occupancy.studentId);
    revalidatePath(`/admin/rooms/${occupancy.roomId}`);

    const remaining = await prisma.occupancy.count({
      where: { roomId: occupancy.roomId, status: 'ACTIVE' },
    });
    const note = remaining > 0
      ? ` Room ${occupancy.room.code} now has ${remaining} student(s), so their share changes from next month.`
      : '';
    return ok(`${occupancy.student.fullName} moved out of ${occupancy.room.code}.${note}`);
  } catch (err) {
    return fail(err.message);
  }
}

/** Move a student between rooms: close one occupancy, open the next. */
export async function transferRoom(prevState, formData) {
  try {
    const user = await requireStaff();
    const occupancyId = String(formData.get('occupancyId') ?? '');
    const roomId = String(formData.get('roomId') ?? '');
    const when = String(formData.get('startDate') ?? '') || isoDate();

    const current = await prisma.occupancy.findUnique({
      where: { id: occupancyId },
      include: { room: true, student: true },
    });
    if (!current || current.status !== 'ACTIVE') return fail('That student is not currently housed.');
    if (current.roomId === roomId) return fail('That is the room they are already in.');

    const target = await prisma.room.findUnique({ where: { id: roomId } });
    if (!target) return fail('That room no longer exists.');
    if (target.status !== 'ACTIVE') return fail(`Room ${target.code} is not in use.`);

    const occupants = await prisma.occupancy.count({ where: { roomId, status: 'ACTIVE' } });
    if (occupants >= target.capacity) return fail(`Room ${target.code} is full.`);
    if (target.gender !== 'ANY' && target.gender !== current.student.gender) {
      return fail(`Room ${target.code} is not open to that gender.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.occupancy.update({
        where: { id: occupancyId },
        data: { status: 'ENDED', endReason: 'TRANSFERRED', endDate: dateOnly(when) },
      });
      await tx.occupancy.create({
        data: {
          studentId: current.studentId,
          roomId,
          startDate: dateOnly(when),
          status: 'ACTIVE',
          createdById: user.id,
        },
      });
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'OCCUPANCY_TRANSFERRED', entity: 'Occupancy', entityId: occupancyId,
      before: { room: current.room.code }, after: { room: target.code, on: when },
    });

    refresh(current.studentId);
    return ok(
      `${current.student.fullName} moved from ${current.room.code} to ${target.code}. This month\u2019s bill stays with ${current.room.code}.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}
