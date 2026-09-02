import { prisma } from '@/lib/db';
import { releaseExpiredHolds } from '@/actions/bookings';
import { formatDate, formatDateTime, nairobiToday, isoDate } from '@/lib/dates';
import { displayPhone } from '@/lib/validation';
import PageHeader from '@/components/PageHeader';
import Empty from '@/components/Empty';
import BookingQueue from './BookingQueue';
import HoldSweeper from './HoldSweeper';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bookings — Lepamus Residency' };

const STATUS_LABEL = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  WAITLISTED: 'Waiting list',
  REJECTED: 'Closed',
  CONVERTED: 'Moved in',
  EXPIRED: 'Hold expired',
};

export default async function BookingsPage() {
  // Holds that have run out are released whenever the queue is opened. The
  // sweep only ever touches approved bookings whose hold is already past, so
  // running it on every visit is harmless — and it means the availability page
  // is right without waiting for a scheduler that is not set up yet.
  await releaseExpiredHolds();

  const [open, recent, settings] = await Promise.all([
    prisma.booking.findMany({
      where: { status: { in: ['PENDING', 'WAITLISTED', 'APPROVED'] } },
      include: {
        category: { select: { name: true, capacity: true } },
        assignedRoom: { select: { code: true } },
        student: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.booking.findMany({
      where: { status: { in: ['REJECTED', 'EXPIRED', 'CONVERTED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.settings.findUnique({ where: { id: 'singleton' } }),
  ]);

  const pending = open.filter((b) => b.status !== 'APPROVED');
  const holding = open.filter((b) => b.status === 'APPROVED');

  // Rooms that could actually take somebody, so the picker never offers a refusal.
  const rooms = await prisma.room.findMany({
    where: { status: 'ACTIVE' },
    include: {
      block: { select: { name: true } },
      _count: { select: { occupancies: { where: { status: 'ACTIVE' } } } },
    },
    orderBy: [{ block: { sortOrder: 'asc' } }, { code: 'asc' }],
  });

  const options = rooms
    .filter((r) => r._count.occupancies < r.capacity)
    .map((r) => ({
      id: r.id,
      gender: r.gender,
      label: `${r.code} — ${r.capacity - r._count.occupancies} free of ${r.capacity}`,
    }));

  const today = nairobiToday();
  const todayIso = isoDate();

  return (
    <>
      <PageHeader eyebrow="Front desk" title="Bookings" count={pending.length}>
        <HoldSweeper />
      </PageHeader>
      <p className="-mt-2 mb-6 max-w-2xl text-sm text-ink-soft">
        An enquiry is a statement of interest, not a reservation. Approving one
        creates the student, gives them a room and issues a login — and holds the
        bed for {settings?.bookingHoldDays ?? 5} days.
      </p>

      <section>
        <h2 className="font-cond text-lg font-semibold">To decide</h2>
        {pending.length === 0 ? (
          <div className="mt-2">
            <Empty
              title="No enquiries waiting"
              body="Enquiries sent from the website land here. Nothing is held or promised until you approve one."
            />
          </div>
        ) : (
          <BookingQueue
            bookings={pending.map((b) => ({
              id: b.id,
              reference: b.reference,
              fullName: b.fullName,
              phone: displayPhone(b.phone),
              email: b.email,
              gender: b.gender,
              institution: b.institution,
              categoryName: b.category?.name ?? null,
              desiredMoveIn: b.desiredMoveIn ? formatDate(b.desiredMoveIn) : null,
              message: b.message,
              status: b.status,
              requestedRoom: b.requestedRoomCode ?? null,
              waitingSince: formatDate(b.createdAt),
              ageDays: Math.floor((Date.now() - b.createdAt.getTime()) / 86400000),
            }))}
            rooms={options}
            today={todayIso}
          />
        )}
      </section>

      {holding.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-cond text-lg font-semibold">Beds on hold</h2>
          <p className="hint mb-2">
            Approved and waiting for the student to pay or move in. When the hold
            runs out the bed goes back to the website automatically.
          </p>
          <div className="card overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Student</th>
                  <th>Room</th>
                  <th>Hold ends</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {holding.map((b) => {
                  const daysLeft = b.holdExpiresAt
                    ? Math.ceil((b.holdExpiresAt.getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <tr key={b.id}>
                      <td className="num text-sm">{b.reference}</td>
                      <td>{b.student?.fullName ?? b.fullName}</td>
                      <td className="num">{b.assignedRoom?.code ?? '—'}</td>
                      <td className="text-sm">
                        {b.holdExpiresAt ? formatDate(b.holdExpiresAt) : '—'}
                        {daysLeft !== null ? (
                          <span className={`block text-xs ${daysLeft <= 1 ? 'text-unpaid' : 'text-ink-faint'}`}>
                            {daysLeft <= 0 ? 'runs out today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                          </span>
                        ) : null}
                      </td>
                      <td className="right">
                        {b.student ? (
                          <a
                            href={`/admin/students/${b.student.id}/statement`}
                            className="text-sm text-enamel hover:underline"
                          >
                            Statement
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-cond text-lg font-semibold">Closed enquiries</h2>
          <div className="card mt-2 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Enquired</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id}>
                    <td className="num text-sm">{b.reference}</td>
                    <td>{b.fullName}</td>
                    <td className="num text-sm">{displayPhone(b.phone)}</td>
                    <td className="text-sm">{formatDate(b.createdAt)}</td>
                    <td className="text-sm">{STATUS_LABEL[b.status] ?? b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
