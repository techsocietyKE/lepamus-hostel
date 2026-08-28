/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function normalisePhone(input) {
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  let n = digits;
  if (n.startsWith('254')) n = n.slice(3);
  else if (n.startsWith('0')) n = n.slice(1);
  if (n.length !== 9) return null;
  return `254${n}`;
}

async function main() {
  // Settings — one row, seeded with the confirmed Till details.
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      hostelName: 'Lepamus Residency',
      tillNumber: '4806384',
      tillBusinessName: 'LEPAMUS RESIDENCY',
      rentDueDay: 5,
      graceDays: 7,
      bookingHoldDays: 5,
    },
  });
  console.log('settings ready');

  // Sharing categories. Rooms never pick one directly — capacity decides.
  for (const [capacity, name] of [[1, 'Single'], [2, '2 Sharing'], [3, '3 Sharing']]) {
    await prisma.roomCategory.upsert({
      where: { capacity },
      update: {},
      create: { capacity, name, isPublic: true, maxShownPublicly: 5 },
    });
  }
  console.log('room categories ready');

  // The proprietor's account.
  const phone = normalisePhone(process.env.SEED_ADMIN_PHONE || '0700000000');
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme123';
  const name = process.env.SEED_ADMIN_NAME || 'Proprietor';

  if (!phone) {
    throw new Error('SEED_ADMIN_PHONE is not a valid Kenyan mobile number.');
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.log(`super admin already exists (${phone}) — left untouched`);
  } else {
    await prisma.user.create({
      data: {
        name,
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'SUPER_ADMIN',
      },
    });
    console.log(`super admin created: ${phone}`);
    console.log('   sign in with that number and the password from SEED_ADMIN_PASSWORD');
    console.log('   change the password after the first sign-in');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
