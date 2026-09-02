import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ksh, splitRent } from '@/lib/money';
import { roomStateLabel } from '@/lib/occupancy';
import PageHeader from '@/components/PageHeader';
import BedMeter from '@/components/BedMeter';
import Empty from '@/components/Empty';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rooms — Lepamus Residency' };

const GENDER_LABEL = { MALE: 'Men', FEMALE: 'Women', ANY: 'Any' };

export default async function RoomsPage({ searchParams }) {
  const params = (await searchParams) ?? {};
  const blockFilter = params.block ?? '';
  const genderFilter = params.gender ?? '';
  const onlyFree = params.free === '1';

  const [blocks, rooms] = await Promise.all([
    prisma.block.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.room.findMany({
      where: {
        ...(blockFilter ? { block: { name: blockFilter } } : {}),
        ...(genderFilter ? { gender: genderFilter } : {}),
      },
      include: {
        block: true,
        _count: { select: { occupancies: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: [{ block: { sortOrder: 'asc' } }, { code: 'asc' }],
    }),
  ]);

  const visible = onlyFree
    ? rooms.filter((r) => r.status === 'ACTIVE' && r._count.occupancies < r.capacity)
    : rooms;

  if (rooms.length === 0 && !blockFilter && !genderFilter && !onlyFree) {
    return (
      <>
        <PageHeader eyebrow="Structure" title="Rooms" />
        <Empty
          title="No rooms yet"
          body="Enter each room as block, room number, capacity, rent and gender. Add and change them whenever the hostel changes."
          actionHref={blocks.length ? '/admin/rooms/new' : '/admin/blocks'}
          actionLabel={blocks.length ? 'Add the first rooms' : 'Create a block first'}
        />
      </>
    );
  }

  const totalBeds = visible.reduce((s, r) => s + r.capacity, 0);
  const totalTaken = visible.reduce((s, r) => s + r._count.occupancies, 0);

  const filterLink = (patch) => {
    const next = new URLSearchParams();
    const merged = { block: blockFilter, gender: genderFilter, free: onlyFree ? '1' : '', ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/admin/rooms?${qs}` : '/admin/rooms';
  };

  return (
    <>
      <PageHeader eyebrow="Structure" title="Rooms" count={visible.length}>
        <Link href="/admin/rooms/new" className="btn btn-primary">Add rooms</Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
        <Link
          href={filterLink({ block: '' })}
          className={`rounded-sm px-2 py-1 ${!blockFilter ? 'bg-enamel text-white' : 'text-ink-soft hover:bg-wall'}`}
        >
          All blocks
        </Link>
        {blocks.map((b) => (
          <Link
            key={b.id}
            href={filterLink({ block: b.name })}
            className={`num rounded-sm px-2 py-1 ${blockFilter === b.name ? 'bg-enamel text-white' : 'text-ink-soft hover:bg-wall'}`}
          >
            {b.name}
          </Link>
        ))}

        <span className="mx-1 h-4 w-px bg-rule-strong" aria-hidden />

        {['', 'MALE', 'FEMALE', 'ANY'].map((g) => (
          <Link
            key={g || 'all'}
            href={filterLink({ gender: g })}
            className={`rounded-sm px-2 py-1 ${genderFilter === g ? 'bg-enamel text-white' : 'text-ink-soft hover:bg-wall'}`}
          >
            {g ? GENDER_LABEL[g] : 'Any gender'}
          </Link>
        ))}

        <span className="mx-1 h-4 w-px bg-rule-strong" aria-hidden />

        <Link
          href={filterLink({ free: onlyFree ? '' : '1' })}
          className={`rounded-sm px-2 py-1 ${onlyFree ? 'bg-enamel text-white' : 'text-ink-soft hover:bg-wall'}`}
        >
          With space
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-ink-soft">
          No rooms match those filters.{' '}
          <Link href="/admin/rooms" className="text-enamel hover:underline">Clear them</Link>.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th>Room</th>
                <th>Block</th>
                <th>Gender</th>
                <th className="right">Occupied</th>
                <th className="right">Room rent</th>
                <th className="right">Each pays now</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((room) => {
                const occupied = room._count.occupancies;
                const state = roomStateLabel(occupied, room.capacity, room.status);
                const shareNow = occupied > 0 ? splitRent(room.monthlyRent, occupied)[0] : null;
                return (
                  <tr key={room.id}>
                    <td>
                      <BedMeter
                        occupied={occupied}
                        capacity={room.capacity}
                        out={room.status !== 'ACTIVE'}
                        size="sm"
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {room.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={room.images[0]}
                            alt={`Room ${room.code}`}
                            className="h-8 w-10 rounded-sm object-cover border border-rule"
                          />
                        ) : null}
                        <Link href={`/admin/rooms/${room.id}`} className="num font-medium text-enamel hover:underline">
                          {room.code}
                        </Link>
                      </div>
                    </td>
                    <td className="num text-ink-soft">{room.block.name}</td>
                    <td className="text-ink-soft">{GENDER_LABEL[room.gender]}</td>
                    <td className="right num">
                      {occupied}<span className="text-ink-faint">/{room.capacity}</span>
                    </td>
                    <td className="right num">{ksh(room.monthlyRent)}</td>
                    <td className="right num">
                      {shareNow ? ksh(shareNow) : <span className="text-ink-faint">—</span>}
                    </td>
                    <td>
                      <span className={`pill pill-${state.tone}`}>{state.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-rule-strong">
                <td></td>
                <td className="py-2.5 font-cond text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Total
                </td>
                <td colSpan={2}></td>
                <td className="right num font-medium">{totalTaken}/{totalBeds}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
