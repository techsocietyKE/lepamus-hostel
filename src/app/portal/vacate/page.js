import { redirect } from 'next/navigation';
import { currentStudent } from '@/auth';
import { prisma } from '@/lib/db';
import { portalSummary } from '@/lib/portal';
import { ksh } from '@/lib/money';
import { formatDate, isoDate, nairobiToday } from '@/lib/dates';
import VacateForm from './VacateForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vacate — Lepamus Residency' };

const STATUS_LABEL = {
  PENDING: 'Waiting for the office',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

export default async function VacatePage() {
  const me = await currentStudent();
  if (!me) redirect('/login');

  const [summary, lastRequest] = await Promise.all([
    portalSummary(me.id),
    prisma.vacateRequest.findFirst({
      where: { studentId: me.id },
      orderBy: { createdAt: 'desc' },
      include: {
        occupancy: { include: { room: { select: { code: true } } } },
      },
    }),
  ]);

  const { room, balance, occupancy } = summary;
  const today = nairobiToday();
  const todayIso = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  const pending = lastRequest?.status === 'PENDING';

  if (!room) {
    return (
      <>
        <h1 className="font-cond text-2xl font-semibold tracking-tight">Request to vacate</h1>
        <div className="card mt-5 p-5">
          <p className="text-sm text-ink-soft">
            You are not in a room at the moment, so there is nothing to vacate.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="font-cond text-2xl font-semibold tracking-tight">Request to vacate</h1>

      {pending ? (
        <div className="card mt-5 p-5">
          <p className="eyebrow">Request pending</p>
          <p className="mt-1 text-sm">
            You asked to leave {lastRequest.occupancy.room.code} on{' '}
            {formatDate(lastRequest.requestedDate)}. The office will get back to you.
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="eyebrow">Balance at request</dt>
              <dd className="num">{ksh(lastRequest.balanceAtRequest)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Requested</dt>
              <dd>{formatDate(lastRequest.requestedDate)}</dd>
            </div>
          </dl>
          {lastRequest.reason ? (
            <p className="mt-3 whitespace-pre-line border-l-2 border-rule pl-3 text-sm text-ink-soft">
              {lastRequest.reason}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="card mt-5 p-5">
            <p className="eyebrow">Your room</p>
            <p className="num mt-1 text-3xl font-semibold leading-none">{room.code}</p>
            <p className="mt-2 text-sm text-ink-soft">
              Block {room.block.name} · since {formatDate(occupancy.startDate)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Your balance right now is{' '}
              <span className="num font-medium">{ksh(balance)}</span>. It is taken as it
              stands when you file the request.
            </p>
            <p className="hint mt-2">
              Once the office approves, the bed is released and your occupancy is
              closed on the date you choose.
            </p>
          </div>

          <VacateForm today={todayIso} />

          {lastRequest ? (
            <p className="mt-4 text-sm text-ink-soft">
              Your last request was {STATUS_LABEL[lastRequest.status]?.toLowerCase()}.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
