/**
 * What the public availability page shows — §5.9.
 *
 * Confirmed at review: listing every room overwhelms the page. Only rooms with
 * a free bed are listed, at most five per category, and where more have space
 * the exact count is still stated — "and 7 more available" is the thing a
 * prospective student actually wants to know.
 */

import { prisma } from './db.js';
import { priceRange } from './money.js';

export async function availability({ gender = null } = {}, client = prisma) {
  const categories = await client.roomCategory.findMany({
    where: { isPublic: true },
    orderBy: { capacity: 'asc' },
  });

  const rooms = await client.room.findMany({
    where: {
      status: 'ACTIVE',
      category: { isPublic: true },
      // A room set to ANY is open to everyone and appears under every filter.
      ...(gender ? { OR: [{ gender: 'ANY' }, { gender }] } : {}),
    },
    include: {
      block: { select: { name: true } },
      _count: { select: { occupancies: { where: { status: 'ACTIVE' } } } },
    },
    orderBy: [{ block: { sortOrder: 'asc' } }, { code: 'asc' }],
  });

  return categories.map((category) => {
    const inCategory = rooms.filter((r) => r.categoryId === category.id);
    const withSpace = inCategory.filter((r) => r._count.occupancies < r.capacity);
    const limit = Math.max(1, category.maxShownPublicly ?? 5);

    const shown = withSpace.slice(0, limit).map((room) => {
      const occupants = room._count.occupancies;
      const price = priceRange(room.monthlyRent, occupants, room.capacity);
      return {
        id: room.id,
        code: room.code,
        blockName: room.block.name,
        gender: room.gender,
        capacity: room.capacity,
        occupants,
        spacesFree: room.capacity - occupants,
        description: room.description ?? category.description ?? null,
        image: room.images?.[0] ?? category.images?.[0] ?? null,
        ifYouJoinNow: price.ifYouJoinNow,
        whenFull: price.whenFull,
      };
    });

    return {
      id: category.id,
      name: category.name,
      capacity: category.capacity,
      description: category.description,
      images: category.images ?? [],
      rooms: shown,
      // A category with nothing free shows as full rather than disappearing:
      // knowing it exists but is taken is useful information.
      totalWithSpace: withSpace.length,
      moreThanShown: Math.max(0, withSpace.length - shown.length),
      bedsFree: withSpace.reduce((sum, r) => sum + (r.capacity - r._count.occupancies), 0),
      isFull: withSpace.length === 0,
      roomsInCategory: inCategory.length,
    };
  }).filter((c) => c.roomsInCategory > 0);
}

export const GENDER_LABEL = { MALE: 'Men', FEMALE: 'Women', ANY: 'Mixed' };
