import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { ksh, splitRent } from '@/lib/money';
import { formatDate, nairobiToday, rotationFor } from '@/lib/dates';
import { roomStateLabel } from '@/lib/occupancy';
import { displayPhone } from '@/lib/validation';
import PageHeader from '@/components/PageHeader';
import BedMeter from '@/components/BedMeter';
import RoomEditor from './RoomEditor';

export const dynamic = 'force-dynamic';

const GENDER_LABEL = { MALE: 'Men only', FEMALE: 'Women only', ANY: 'Any gender' };

export default async function RoomDetail({ params }) {
  const { id } = await params;
  const session = await auth();

  const [room, blocks] = await Promise.all([
    prisma.room.findUnique({
      where: { id },
      include: {
        block: true,
        occupancies: {
          where: { status: 'ACTIVE' },
          include: { student: true },
          orderBy: { startDate: 'asc' },
        },
      },
    }),
    prisma.block.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ]);

  if (!room) notFound();

  const occupied = room.occupancies.length;
  const state = roomStateLabel(occupied, room.capacity, room.status);
  const { year, month } = nairobiToday();
  const shares = splitRent(room.monthlyRent, occupied, rotationFor(year, month));
  const shareIfFull = splitRent(room.monthlyRent, room.capacity)[0];

  return (
    <>
      <PageHeader eyebrow={`Block ${room.block.name}`} title={`Room ${room.code}`}>
        <Link href="/admin/rooms" className="btn btn-quiet">All rooms</Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-start gap-5">
              <BedMeter occupied={occupied} capacity={room.capacity} out={room.status !== 'ACTIVE'} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-2xl font-medium leading-none">
                    {occupied}<span className="text-ink-faint">/{room.capacity}</span>
                  </span>
                  <span className={`pill pill-${state.tone}`}>{state.label}</span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  {GENDER_LABEL[room.gender]} · Room rent{' '}
                  <span className="num text-ink">{ksh(room.monthlyRent)}</span> a month
                </p>
                {room.description ? (
                  <p className="mt-2 text-sm text-ink-soft">{room.description}</p>
                ) : null}
              </div>
            </div>
          </div>

          {room.images?.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="border-b border-rule px-4 py-3">
                <h2 className="font-cond text-base font-semibold">Photographs</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                {room.images.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={img}
                    alt={`Room ${room.code} photo ${i + 1}`}
                    className="aspect-[4/3] w-full rounded-sm object-cover border border-rule"
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="card overflow-hidden">
            <div className="flex items-baseline justify-between border-b border-rule px-4 py-3">
              <h2 className="font-cond text-base font-semibold">Who is in this room</h2>
              <span className="text-xs text-ink-faint">
                Rent divides by the {occupied || 'number of'} people actually here
              </span>
            </div>

            {occupied === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-soft">
                Nobody is in this room. Allocate a student from their record.
              </p>
            ) : (
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Phone</th>
                    <th>Since</th>
                    <th className="right">Share this month</th>
                  </tr>
                </thead>
                <tbody>
                  {room.occupancies.map((o, i) => (
                    <tr key={o.id}>
                      <td>
                        <Link
                          href={`/admin/students/${o.student.id}`}
                          className="font-medium text-enamel hover:underline"
                        >
                          {o.student.fullName}
                        </Link>
                      </td>
                      <td className="num text-ink-soft">{displayPhone(o.student.phone)}</td>
                      <td className="text-ink-soft">{formatDate(o.startDate)}</td>
                      <td className="right num font-medium">{ksh(shares[i] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-rule-strong">
                    <td colSpan={3} className="py-2.5 font-cond text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Room total
                    </td>
                    <td className="right num font-medium">{ksh(room.monthlyRent)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {occupied > 0 && occupied < room.capacity ? (
              <p className="border-t border-rule bg-wall px-4 py-2.5 text-xs text-ink-soft">
                With {room.capacity} people in the room each would pay{' '}
                <span className="num text-ink">{ksh(shareIfFull)}</span>. When someone
                moves out, the remaining students pay more from the following month.
              </p>
            ) : null}
          </div>
        </div>

        <RoomEditor
          room={{
            id: room.id,
            code: room.code,
            blockId: room.blockId,
            capacity: room.capacity,
            monthlyRent: room.monthlyRent,
            gender: room.gender,
            description: room.description ?? '',
            images: room.images ?? [],
            status: room.status,
          }}
          blocks={blocks}
          occupied={occupied}
          isSuperAdmin={session?.user?.role === 'SUPER_ADMIN'}
        />
      </div>
    </>
  );
}
