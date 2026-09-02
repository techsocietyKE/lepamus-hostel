import { prisma } from '@/lib/db';
import { formatDate, formatDateTime } from '@/lib/dates';
import { displayPhone } from '@/lib/validation';
import { ksh } from '@/lib/money';
import PageHeader from '@/components/PageHeader';
import Empty from '@/components/Empty';
import VacateQueue from './VacateQueue';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vacate requests — Lepamus Residency' };

const STATUS_LABEL = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

export default async function VacatePage() {
  const [open, recent] = await Promise.all([
    prisma.vacateRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        student: { select: { id: true, fullName: true, phone: true, status: true } },
        occupancy: { include: { room: { include: { block: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.vacateRequest.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED', 'CANCELLED'] } },
      include: {
        student: { select: { fullName: true } },
        occupancy: { include: { room: { select: { code: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Front desk" title="Vacate requests" count={open.length} />
      <p className="-mt-2 mb-6 max-w-2xl text-sm text-ink-soft">
        A student&rsquo;s notice to leave. Approving one closes their occupancy on
        the requested date and frees the bed. Their balance is snapshotted at
        the moment they asked.
      </p>

      <section>
        <h2 className="font-cond text-lg font-semibold">To decide</h2>
        {open.length === 0 ? (
          <div className="mt-2">
            <Empty
              title="No vacate requests waiting"
              body="Students send a request to vacate from the portal. It lands here for the office to confirm."
            />
          </div>
        ) : (
          <VacateQueue
            requests={open.map((r) => ({
              id: r.id,
              studentName: r.student.fullName,
              studentPhone: displayPhone(r.student.phone),
              roomCode: r.occupancy.room.code,
              blockName: r.occupancy.room.block.name,
              requestedDate: formatDate(r.requestedDate),
              requestedAt: formatDateTime(r.createdAt),
              reason: r.reason,
              balance: r.balanceAtRequest,
            }))}
          />
        )}
      </section>

      {recent.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-cond text-lg font-semibold">Previous decisions</h2>
          <div className="card mt-2 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Room</th>
                  <th>Requested</th>
                  <th>Outcome</th>
                  <th>Decided</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.student.fullName}</td>
                    <td className="num">{r.occupancy.room.code}</td>
                    <td className="text-sm">{formatDate(r.requestedDate)}</td>
                    <td className="text-sm">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="text-sm">{r.decidedAt ? formatDateTime(r.decidedAt) : '—'}</td>
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
