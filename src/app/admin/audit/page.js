import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { formatDateTime } from '@/lib/dates';
import PageHeader from '@/components/PageHeader';
import Empty from '@/components/Empty';
import AuditDetail from './AuditDetail';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit log — Lepamus Residency' };

const PAGE_SIZE = 60;

/** Plain English for what happened, so the log reads without a key. */
const ACTION_LABEL = {
  BLOCK_CREATED: 'Block added',
  BLOCK_UPDATED: 'Block edited',
  BLOCK_DELETED: 'Block removed',
  ROOM_CREATED: 'Room added',
  ROOM_RANGE_CREATED: 'Rooms added in bulk',
  ROOM_UPDATED: 'Room edited',
  ROOM_PRICE_CHANGED: 'Room price changed',
  ROOM_STATUS_CHANGED: 'Room taken in or out of use',
  ROOM_DELETED: 'Room deleted',
  CATEGORY_UPDATED: 'Category edited',
  SETTINGS_UPDATED: 'Settings changed',
  STUDENT_CREATED: 'Student added',
  STUDENT_UPDATED: 'Student edited',
  STUDENT_PHONE_CHANGED: 'Student phone changed',
  STUDENT_STATUS_CHANGED: 'Student status changed',
  OCCUPANCY_OPENED: 'Student allocated a room',
  OCCUPANCY_ENDED: 'Occupancy ended',
  OCCUPANCY_TRANSFERRED: 'Student moved room',
  INVOICES_GENERATED: 'Invoices generated',
  PERIOD_STATUS_CHANGED: 'Month opened or closed',
  INVOICE_DISCOUNTED: 'Invoice discounted',
  RELIEF_GRANTED: 'Reduced rent agreed',
  RELIEF_CANCELLED: 'Reduced rent cancelled',
  CASH_PAYMENT_RECORDED: 'Cash payment recorded',
  TILL_PAYMENT_RECORDED: 'Till payment recorded',
  PAYMENT_APPROVED: 'Payment approved',
  PAYMENT_REJECTED: 'Payment rejected',
  PAYMENTS_BULK_APPROVED: 'Payments approved in bulk',
  PAYMENT_REVERSED: 'Payment reversed',
};

/** Actions that move or change money, which is what most searches are after. */
const MONEY_ACTIONS = Object.keys(ACTION_LABEL).filter((a) =>
  /PAYMENT|INVOICE|RELIEF|PRICE|PERIOD/.test(a));

export default async function AuditPage({ searchParams }) {
  const session = await auth();
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/admin');

  const params = await searchParams;
  const page = Math.max(1, Number(params?.page ?? 1) || 1);
  const filter = params?.filter ?? 'all';

  const where = filter === 'money' ? { action: { in: MONEY_ACTIONS } } : {};

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit log" count={total} />
      <p className="-mt-2 mb-4 max-w-2xl text-sm text-ink-soft">
        Every change to a financial or structural record, with who made it and
        when. This is what lets day-to-day entry be delegated without losing
        control of the records — and what a dispute turns on.
      </p>

      <div className="mb-4 flex gap-2">
        <Link
          href="/admin/audit"
          className={`btn px-3 py-1.5 text-sm ${filter === 'all' ? 'btn-primary' : 'btn-quiet'}`}
        >
          Everything
        </Link>
        <Link
          href="/admin/audit?filter=money"
          className={`btn px-3 py-1.5 text-sm ${filter === 'money' ? 'btn-primary' : 'btn-quiet'}`}
        >
          Money only
        </Link>
      </div>

      {entries.length === 0 ? (
        <Empty
          title="Nothing recorded yet"
          body="Entries appear here as soon as anyone adds a room, allocates a student, or records a payment."
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Record</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-sm">{formatDateTime(e.createdAt)}</td>
                    <td className="text-sm">
                      {e.user?.name ?? 'System'}
                      {e.user ? (
                        <span className="block text-xs text-ink-faint">
                          {e.user.role === 'SUPER_ADMIN' ? 'Proprietor' : 'Clerk'}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-sm">{ACTION_LABEL[e.action] ?? e.action}</td>
                    <td className="text-sm text-ink-soft">{e.entity}</td>
                    <td className="right">
                      {e.before || e.after ? (
                        <AuditDetail before={e.before} after={e.after} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 ? (
            <div className="mt-4 flex items-center gap-3">
              {page > 1 ? (
                <Link
                  href={`/admin/audit?filter=${filter}&page=${page - 1}`}
                  className="btn btn-quiet"
                >
                  Newer
                </Link>
              ) : null}
              <span className="hint">Page {page} of {pages}</span>
              {page < pages ? (
                <Link
                  href={`/admin/audit?filter=${filter}&page=${page + 1}`}
                  className="btn btn-quiet"
                >
                  Older
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
