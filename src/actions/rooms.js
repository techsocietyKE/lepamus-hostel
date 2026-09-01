'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireStaff, requireSuperAdmin } from '@/auth';
import { writeAudit } from '@/lib/audit';
import { categoryForCapacity, activeOccupantCount } from '@/lib/occupancy';
import { createClient } from '@supabase/supabase-js';
import { blockSchema, roomSchema, roomRangeSchema, categorySchema, fieldErrors } from '@/lib/validation';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message, errors = {}) => ({ ok: false, message, errors });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function refresh() {
  revalidatePath('/admin/rooms');
  revalidatePath('/admin/blocks');
  revalidatePath('/admin');
}

// ---------- blocks ----------

export async function createBlock(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const parsed = blockSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted field.', fieldErrors(parsed.error));

    const existing = await prisma.block.findUnique({ where: { name: parsed.data.name } });
    if (existing) return fail(`Block ${parsed.data.name} already exists.`, { name: 'Already in use' });

    const block = await prisma.block.create({ data: parsed.data });
    await writeAudit(prisma, {
      userId: user.id, action: 'BLOCK_CREATED', entity: 'Block',
      entityId: block.id, after: block,
    });
    refresh();
    return ok(`Block ${block.name} added.`);
  } catch (err) {
    return fail(err.message);
  }
}

export async function renameBlock(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const id = String(formData.get('id') ?? '');
    const parsed = blockSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted field.', fieldErrors(parsed.error));

    const before = await prisma.block.findUnique({ where: { id } });
    if (!before) return fail('That block no longer exists.');

    const after = await prisma.block.update({ where: { id }, data: parsed.data });
    await writeAudit(prisma, {
      userId: user.id, action: 'BLOCK_UPDATED', entity: 'Block', entityId: id, before, after,
    });
    refresh();
    return ok(`Block saved.`);
  } catch (err) {
    return fail(err.message);
  }
}

export async function deleteBlock(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const id = String(formData.get('id') ?? '');
    const block = await prisma.block.findUnique({
      where: { id },
      include: { _count: { select: { rooms: true } } },
    });
    if (!block) return fail('That block no longer exists.');
    if (block._count.rooms > 0) {
      return fail(`Block ${block.name} still has ${block._count.rooms} room(s). Move or remove them first.`);
    }
    await prisma.block.delete({ where: { id } });
    await writeAudit(prisma, {
      userId: user.id, action: 'BLOCK_DELETED', entity: 'Block', entityId: id, before: block,
    });
    refresh();
    return ok(`Block ${block.name} removed.`);
  } catch (err) {
    return fail(err.message);
  }
}

// ---------- rooms ----------

export async function createRoom(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = roomSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const data = parsed.data;

    const clash = await prisma.room.findUnique({ where: { code: data.code } });
    if (clash) return fail(`Room ${data.code} already exists.`, { code: 'Already in use' });

    const category = await categoryForCapacity(data.capacity);
    const room = await prisma.room.create({
      data: {
        code: data.code,
        blockId: data.blockId,
        categoryId: category.id,
        capacity: data.capacity,
        monthlyRent: data.monthlyRent,
        gender: data.gender,
        description: data.description,
        createdById: user.id,
      },
    });
    await writeAudit(prisma, {
      userId: user.id, action: 'ROOM_CREATED', entity: 'Room', entityId: room.id, after: room,
    });
    refresh();
    return ok(`Room ${room.code} added.`);
  } catch (err) {
    return fail(err.message);
  }
}

/**
 * Bulk entry over the same validation — a shortcut, not a separate mechanism.
 * Room numbers that already exist are skipped, so the same range can be
 * re-entered safely when a block is extended later.
 */
export async function createRoomRange(prevState, formData) {
  try {
    const user = await requireStaff();
    const parsed = roomRangeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const d = parsed.data;

    const codes = [];
    for (let n = d.from; n <= d.to; n += 1) codes.push(`${d.prefix}${n}`);

    const existing = await prisma.room.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    const taken = new Set(existing.map((r) => r.code));
    const toCreate = codes.filter((c) => !taken.has(c));

    if (toCreate.length === 0) {
      return fail(`All ${codes.length} of those room numbers already exist. Nothing to add.`);
    }

    const category = await categoryForCapacity(d.capacity);
    const created = await prisma.room.createMany({
      data: toCreate.map((code) => ({
        code,
        blockId: d.blockId,
        categoryId: category.id,
        capacity: d.capacity,
        monthlyRent: d.monthlyRent,
        gender: d.gender,
        description: d.description,
        createdById: user.id,
      })),
      skipDuplicates: true,
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'ROOM_RANGE_CREATED', entity: 'Room',
      after: { codes: toCreate, capacity: d.capacity, monthlyRent: d.monthlyRent, gender: d.gender },
    });
    refresh();

    const skipped = codes.length - toCreate.length;
    return ok(
      skipped > 0
        ? `Added ${created.count} rooms. Skipped ${skipped} that already existed.`
        : `Added ${created.count} rooms.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}

export async function updateRoom(prevState, formData) {
  try {
    const user = await requireStaff();
    const id = String(formData.get('id') ?? '');
    const parsed = roomSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const data = parsed.data;

    const before = await prisma.room.findUnique({ where: { id } });
    if (!before) return fail('That room no longer exists.');

    if (data.code !== before.code) {
      const clash = await prisma.room.findUnique({ where: { code: data.code } });
      if (clash) return fail(`Room ${data.code} already exists.`, { code: 'Already in use' });
    }

    // Only the proprietor changes prices, because the figure ends up on invoices.
    if (data.monthlyRent !== before.monthlyRent && user.role !== 'SUPER_ADMIN') {
      return fail('Only the proprietor can change a room price.');
    }

    const occupants = await activeOccupantCount(id);
    if (data.capacity < occupants) {
      return fail(
        `Room ${before.code} has ${occupants} student(s) in it. Move someone out before reducing it to ${data.capacity} bed(s).`,
        { capacity: `At least ${occupants} needed` },
      );
    }

    const category = await categoryForCapacity(data.capacity);
    const after = await prisma.room.update({
      where: { id },
      data: {
        code: data.code,
        blockId: data.blockId,
        categoryId: category.id,
        capacity: data.capacity,
        monthlyRent: data.monthlyRent,
        gender: data.gender,
        description: data.description,
      },
    });

    await writeAudit(prisma, {
      userId: user.id,
      action: data.monthlyRent !== before.monthlyRent ? 'ROOM_PRICE_CHANGED' : 'ROOM_UPDATED',
      entity: 'Room', entityId: id, before, after,
    });
    refresh();
    revalidatePath(`/admin/rooms/${id}`);

    const genderChanged = data.gender !== before.gender;
    return ok(
      genderChanged && occupants > 0
        ? `Room ${after.code} saved. It has ${occupants} student(s) in it — the change does not move anyone.`
        : `Room ${after.code} saved.`,
    );
  } catch (err) {
    return fail(err.message);
  }
}

export async function setRoomStatus(prevState, formData) {
  try {
    const user = await requireStaff();
    const id = String(formData.get('id') ?? '');
    const status = String(formData.get('status') ?? '');
    if (!['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(status)) return fail('Unknown room status.');

    const before = await prisma.room.findUnique({ where: { id } });
    if (!before) return fail('That room no longer exists.');

    if (status !== 'ACTIVE') {
      const occupants = await activeOccupantCount(id);
      if (occupants > 0) {
        return fail(`Room ${before.code} has ${occupants} student(s) in it. Move them out first.`);
      }
    }

    const after = await prisma.room.update({ where: { id }, data: { status } });
    await writeAudit(prisma, {
      userId: user.id, action: 'ROOM_STATUS_CHANGED', entity: 'Room', entityId: id, before, after,
    });
    refresh();
    revalidatePath(`/admin/rooms/${id}`);
    const label = { ACTIVE: 'back in use', MAINTENANCE: 'under maintenance', INACTIVE: 'out of use' }[status];
    return ok(`Room ${after.code} is now ${label}.`);
  } catch (err) {
    return fail(err.message);
  }
}

// ---------- categories ----------

/**
 * Categories are not created or removed by hand — capacity brings them into
 * existence. What the proprietor controls is how each one presents itself to a
 * visitor: the photographs, the description, and how many rooms the
 * availability page lists before it falls back to "and 7 more".
 */
export async function updateCategory(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    
    const rawData = {
      id: formData.get('id'),
      description: formData.get('description'),
      images: formData.getAll('images'), 
      maxShownPublicly: formData.get('maxShownPublicly'),
      isPublic: formData.get('isPublic'),
    };

    const parsed = categorySchema.safeParse(rawData);
    if (!parsed.success) return fail('Check the highlighted fields.', fieldErrors(parsed.error));
    const { id, ...data } = parsed.data;

    const before = await prisma.roomCategory.findUnique({ where: { id } });
    if (!before) return fail('That category no longer exists.');

    let finalImageUrls = [];

    // 1. Upload files to Supabase Storage if any were provided
   // 1. Upload files to Supabase Storage if any were provided
    if (data.images && data.images.length > 0) {
      const uploadPromises = data.images.map(async (file) => {
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        
        // CONVERT THE FILE TO AN ARRAYBUFFER
        const fileBody = await file.arrayBuffer();

        // Upload to the 'categories' bucket you created
        const { error: uploadError } = await supabase
          .storage
          .from('categories')
          .upload(filename, fileBody, {
            contentType: file.type, // Explicitly tell Supabase it's an image
          });

        if (uploadError) throw new Error(uploadError.message);

        // Get the permanent public web address for the image
        const { data: { publicUrl } } = supabase
          .storage
          .from('categories')
          .getPublicUrl(filename);

        return publicUrl;
      });
      
      finalImageUrls = await Promise.all(uploadPromises);
    }

    const updateData = {
      description: data.description,
      maxShownPublicly: data.maxShownPublicly,
      isPublic: data.isPublic,
    };

    if (finalImageUrls.length > 0) {
      updateData.images = finalImageUrls;
    }

    // 2. Update the Postgres Database
    const after = await prisma.roomCategory.update({ 
      where: { id }, 
      data: updateData 
    });

    await writeAudit(prisma, {
      userId: user.id, action: 'CATEGORY_UPDATED', entity: 'RoomCategory',
      entityId: id, before, after,
    });
    
    revalidatePath('/admin/categories');
    revalidatePath('/admin/rooms');

    return ok(
      after.isPublic
        ? `${after.name} saved.`
        : `${after.name} saved. It is hidden from the website.`,
    );
  } catch (err) {
    console.error('Upload error:', err);
    return fail('Failed to upload images or update category.');
  }
}

/** Only a room that has never been lived in can be deleted — that is a typo. */
export async function deleteRoom(prevState, formData) {
  try {
    const user = await requireSuperAdmin();
    const id = String(formData.get('id') ?? '');
    const room = await prisma.room.findUnique({
      where: { id },
      include: { _count: { select: { occupancies: true, invoices: true } } },
    });
    if (!room) return fail('That room no longer exists.');

    if (room._count.occupancies > 0 || room._count.invoices > 0) {
      return fail(
        `Room ${room.code} has history against it. Take it out of use instead — deleting it would break past records.`,
      );
    }

    await prisma.room.delete({ where: { id } });
    await writeAudit(prisma, {
      userId: user.id, action: 'ROOM_DELETED', entity: 'Room', entityId: id, before: room,
    });
    refresh();
    return ok(`Room ${room.code} deleted.`);
  } catch (err) {
    return fail(err.message);
  }
}