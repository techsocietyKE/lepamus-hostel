import { prisma } from './db.js';
import { splitRent } from './money.js';

/** How many people are actually living in a room right now. The divisor. */
export async function activeOccupantCount(roomId, client = prisma) {
  return client.occupancy.count({ where: { roomId, status: 'ACTIVE' } });
}

export const CATEGORY_NAMES = {
  1: 'Single',
  2: '2 Sharing',
  3: '3 Sharing',
};

/** Category follows from capacity, so the two can never disagree. */
export function categoryNameFor(capacity) {
  return CATEGORY_NAMES[capacity] ?? `${capacity} Sharing`;
}

/** Find or create the category for a capacity. Rooms never pick one directly. */
export async function categoryForCapacity(capacity, client = prisma) {
  const existing = await client.roomCategory.findUnique({ where: { capacity } });
  if (existing) return existing;
  return client.roomCategory.create({
    data: { capacity, name: categoryNameFor(capacity), isPublic: true },
  });
}

/**
 * The single gate for every allocation. Returns { ok, reason, code } rather
 * than throwing, so the interface can explain the refusal.
 *
 * A room set to ANY takes anyone. A room set to MALE or FEMALE refuses the
 * other gender outright rather than warning about it.
 */
export async function canAllocate(studentId, roomId, client = prisma) {
  const [student, room] = await Promise.all([
    client.student.findUnique({ where: { id: studentId } }),
    client.room.findUnique({ where: { id: roomId } }),
  ]);

  if (!student) return { ok: false, code: 'NO_STUDENT', reason: 'That student no longer exists.' };
  if (!room) return { ok: false, code: 'NO_ROOM', reason: 'That room no longer exists.' };

  if (student.status === 'BLACKLISTED') {
    return { ok: false, code: 'BLACKLISTED', reason: `${student.fullName} is blacklisted.` };
  }

  if (room.status !== 'ACTIVE') {
    const label = room.status === 'MAINTENANCE' ? 'under maintenance' : 'out of use';
    return { ok: false, code: 'ROOM_INACTIVE', reason: `Room ${room.code} is ${label}.` };
  }

  const existing = await client.occupancy.findFirst({
    where: { studentId, status: 'ACTIVE' },
    include: { room: true },
  });
  if (existing) {
    return {
      ok: false,
      code: 'ALREADY_HOUSED',
      reason: `${student.fullName} is already in room ${existing.room.code}. Move them instead.`,
    };
  }

  if (room.gender !== 'ANY' && room.gender !== student.gender) {
    const roomIs = room.gender === 'MALE' ? 'a men\u2019s room' : 'a women\u2019s room';
    return {
      ok: false,
      code: 'GENDER',
      reason: `Room ${room.code} is ${roomIs}.`,
      overridable: true,
    };
  }

  const occupants = await activeOccupantCount(roomId, client);
  if (occupants >= room.capacity) {
    return {
      ok: false,
      code: 'FULL',
      reason: `Room ${room.code} is full at ${occupants}/${room.capacity}.`,
      overridable: true,
    };
  }

  return { ok: true, room, student, occupantsAfter: occupants + 1 };
}

/** What each occupant pays this month, given who is actually in the room. */
export async function currentShares(roomId, rotation = 0, client = prisma) {
  const room = await client.room.findUnique({
    where: { id: roomId },
    include: {
      occupancies: {
        where: { status: 'ACTIVE' },
        include: { student: true },
        orderBy: { startDate: 'asc' },
      },
    },
  });
  if (!room) return [];
  const shares = splitRent(room.monthlyRent, room.occupancies.length, rotation);
  return room.occupancies.map((o, i) => ({
    occupancyId: o.id,
    student: o.student,
    share: shares[i] ?? 0,
  }));
}

/** Occupancy summary for a list of rooms, in one query rather than N. */
export async function occupancyByRoom(roomIds, client = prisma) {
  const rows = await client.occupancy.groupBy({
    by: ['roomId'],
    where: { roomId: { in: roomIds }, status: 'ACTIVE' },
    _count: { _all: true },
  });
  const map = new Map(roomIds.map((id) => [id, 0]));
  for (const r of rows) map.set(r.roomId, r._count._all);
  return map;
}

export function roomStateLabel(occupants, capacity, status) {
  if (status === 'MAINTENANCE') return { label: 'Under maintenance', tone: 'out' };
  if (status === 'INACTIVE') return { label: 'Out of use', tone: 'out' };
  if (occupants === 0) return { label: 'Vacant', tone: 'vacant' };
  if (occupants >= capacity) return { label: 'Full', tone: 'full' };
  const free = capacity - occupants;
  return { label: `${free} space${free === 1 ? '' : 's'} free`, tone: 'part' };
}
