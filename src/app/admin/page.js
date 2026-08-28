import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ksh } from '@/lib/money';
import PageHeader from '@/components/PageHeader';
import BedMeter from '@/components/BedMeter';
import Empty from '@/components/Empty';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [blocks, rooms, students, occupancies, overdue, arrears, staleClaims] = await Promise.all([
    prisma.block.count({ where: { isActive: true } }),
    prisma.room.findMany({
      where: { status: 'ACTIVE' },
      include: { block: true },
      orderBy: [{ block: { sortOrder: 'asc' } }, { code: 'asc' }],
    }),
    prisma.student.count({ where: { status: 'ACTIVE' } }),
    prisma.occupancy.groupBy({
      by: ['roomId'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
    }),
    // Past the grace period and still owing — §5.4 Rule 5. No penalty is ever
    // added; what the grace period changes is the status and this list.
    prisma.invoice.findMany({
      where: { status: 'OVERDUE', closingBalance: { gt: 0 } },
      include: {
        student: { select: { id: true, fullName: true } },
        room: { select: { code: true } },
        period: { select: { label: true } },
      },
      orderBy: [{ graceEndsOn: 'asc' }],
      take: 12,
    }),
    prisma.invoice.aggregate({
      where: { closingBalance: { gt: 0 } },
      _sum: { closingBalance: true },
      _count: { _all: true },
    }),
    prisma.payment.count({ where: { status: 'SUBMITTED' } }),
  ]);

  if (rooms.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Set up the hostel" />
        <Empty
          title="No rooms yet"
          body="Start by creating a block, then enter its rooms — block, room number, capacity, rent and gender. You can add more at any time as the hostel changes."
          actionHref="/admin/blocks"
          actionLabel="Create the first block"
        />
      </>
    );
  }

  const filled = new Map(occupancies.map((o) => [o.roomId, o._count._all]));
  const beds = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const taken = rooms.reduce((sum, r) => sum + (filled.get(r.id) ?? 0), 0);
  const free = beds - taken;
  const potential = rooms.reduce((sum, r) => sum + r.monthlyRent, 0);

  // Group by block so the tiles read like walking the corridors.
  const byBlock = new Map();
  for (const room of rooms) {
    const key = room.block.name;
    if (!byBlock.has(key)) byBlock.set(key, []);
    byBlock.get(key).push(room);
  }

  const owed = arrears._sum.closingBalance ?? 0;

  const stats = [
    { label: 'Beds taken', value: `${taken}`, sub: `of ${beds}` },
    { label: 'Free beds', value: `${free}`, sub: free === 0 ? 'hostel is full' : 'available now' },
    { label: 'Active students', value: `${students}`, sub: students === taken ? 'all housed' : 'on file' },
    {
      label: 'Owed to the hostel',
      value: ksh(owed),
      sub: arrears._count._all === 0
        ? 'nothing outstanding'
        : `across ${arrears._count._all} invoice(s)`,
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Overview" title="Lepamus Residency">
        <Link href="/admin/rooms/new" className="btn btn-primary">Add rooms</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="eyebrow">{s.label}</p>
            <p className="num mt-1 text-2xl font-medium leading-none">{s.value}</p>
            <p className="mt-1.5 text-xs text-ink-faint">{s.sub}</p>
          </div>
        ))}
      </div>

      {overdue.length > 0 || staleClaims > 0 ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {overdue.length > 0 ? (
            <div className="card p-5">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="font-cond text-lg font-semibold">Overdue</h2>
                <Link href="/admin/ledger" className="text-sm text-enamel hover:underline">
                  Open the sheet
                </Link>
              </div>
              <p className="hint mb-3">
                Past the grace period and still owing. No penalty is added — the
                grace period changes the status, never the money.
              </p>
              <ul className="space-y-1.5">
                {overdue.map((inv) => (
                  <li key={inv.id} className="flex items-baseline justify-between gap-3 border-b border-rule pb-1.5 text-sm last:border-0">
                    <Link
                      href={`/admin/students/${inv.student.id}/statement`}
                      className="hover:underline"
                    >
                      {inv.student.fullName}
                      <span className="num ml-2 text-xs text-ink-faint">
                        {inv.room.code} · {inv.period.label}
                      </span>
                    </Link>
                    <span className="num font-medium text-unpaid">{ksh(inv.closingBalance)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {staleClaims > 0 ? (
            <div className="card h-fit p-5">
              <h2 className="font-cond text-lg font-semibold">Payments to check</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {staleClaims} submitted payment{staleClaims === 1 ? '' : 's'} waiting on a
                decision. A claim changes nothing until it is approved, so a
                student who has paid still shows as owing until you check it.
              </p>
              <Link href="/admin/payments" className="btn btn-primary mt-3">
                Open the queue
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-cond text-lg font-semibold">Rooms by block</h2>
          <Link href="/admin/rooms" className="text-sm text-enamel hover:underline">
            Open the room list
          </Link>
        </div>

        <div className="space-y-5">
          {[...byBlock.entries()].map(([blockName, blockRooms]) => {
            const blockBeds = blockRooms.reduce((s, r) => s + r.capacity, 0);
            const blockTaken = blockRooms.reduce((s, r) => s + (filled.get(r.id) ?? 0), 0);
            return (
              <div key={blockName}>
                <div className="mb-2 flex items-baseline gap-2 border-b border-rule pb-1.5">
                  <span className="font-cond text-sm font-semibold">Block {blockName}</span>
                  <span className="num text-xs text-ink-faint">
                    {blockTaken}/{blockBeds} beds
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {blockRooms.map((room) => {
                    const occupied = filled.get(room.id) ?? 0;
                    return (
                      <Link
                        key={room.id}
                        href={`/admin/rooms/${room.id}`}
                        className="card flex items-center gap-3 p-2.5 hover:border-enamel"
                      >
                        <BedMeter occupied={occupied} capacity={room.capacity} size="sm" />
                        <div className="min-w-0">
                          <p className="num text-sm font-medium leading-tight">{room.code}</p>
                          <p className="num text-xs text-ink-faint">
                            {occupied}/{room.capacity}
                            <span className="font-sans"> · </span>
                            {room.gender === 'ANY' ? 'Any' : room.gender === 'MALE' ? 'Men' : 'Women'}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
