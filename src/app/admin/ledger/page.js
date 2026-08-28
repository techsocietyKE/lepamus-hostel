import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ledgerFor } from '@/lib/billing';
import { fmt } from '@/lib/money';
import { formatDate, nairobiToday, monthLabel } from '@/lib/dates';
import PageHeader from '@/components/PageHeader';
import Empty from '@/components/Empty';
import PeriodBar from './PeriodBar';
import PaidCell from './PaidCell';
import ChargePanel from './ChargePanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Monthly sheet — Lepamus Residency' };

const STATUS_LABEL = {
  PAID: 'Paid',
  PARTIAL: 'Part paid',
  UNPAID: 'Unpaid',
  OVERDUE: 'Overdue',
  WAIVED: 'Waived',
};

export default async function LedgerPage({ searchParams }) {
  const params = await searchParams;
  const periods = await prisma.billingPeriod.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { _count: { select: { invoices: true } } },
  });

  const today = nairobiToday();
  const selected = params?.period
    ? periods.find((p) => p.id === params.period)
    : periods[0];

  if (!selected) {
    return (
      <>
        <PageHeader eyebrow="Money" title="Monthly sheet" />
        <PeriodBar periods={periods} selected={null} defaults={today} />
        <div className="mt-6">
          <Empty
            title={`No month is open yet`}
            body={`Open ${monthLabel(today.year, today.month)} above, then generate the invoices. Nothing is billed until you press generate.`}
          />
        </div>
      </>
    );
  }

  const { rooms, invoices, totals } = await ledgerFor(selected.id);

  return (
    <>
      <PageHeader eyebrow="Money" title={selected.label} count={invoices.length}>
        {selected.status === 'CLOSED' ? (
          <span className="eyebrow rounded-sm border border-rule px-2 py-1">Closed</span>
        ) : null}
        {invoices.length > 0 ? (
          <a href={`/admin/ledger/export?period=${selected.id}`} className="btn btn-quiet">
            Export CSV
          </a>
        ) : null}
      </PageHeader>

      <PeriodBar periods={periods} selected={selected} defaults={today} />

      {invoices.length === 0 ? (
        <div className="mt-6">
          <Empty
            title={`${selected.label} has no invoices yet`}
            body="Generate them above. Every student currently allocated to a room gets one invoice, and running it twice cannot double-bill anybody."
          />
        </div>
      ) : (
        <>
          <div className="card mt-6 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Student</th>
                  <th className="right">Opening</th>
                  <th className="right">Rent share</th>
                  <th className="right">Charges</th>
                  <th className="right">Discount</th>
                  <th className="right">Paid</th>
                  <th className="right">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <RoomGroup key={room.roomId} room={room} locked={selected.status === 'CLOSED'} />
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2}>Hostel total</td>
                  <td className="right num">{fmt(totals.opening)}</td>
                  <td className="right num">{fmt(totals.rent)}</td>
                  <td className="right num">{fmt(totals.charges)}</td>
                  <td className="right num">{fmt(totals.discount)}</td>
                  <td className="right num">{fmt(totals.paid)}</td>
                  <td className="right num">{fmt(totals.balance)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-3 text-sm text-ink-soft">
            Due {formatDate(selected.dueDate)}. Rent shares were fixed when the
            invoices were generated — {invoices.length} student(s) across{' '}
            {rooms.length} room(s). A roommate moving in later does not change
            anyone else&rsquo;s bill for this month.
          </p>
          <p className="hint mt-1">
            To take cash at the counter: type the amount in the Paid column and
            click Save. It settles the oldest unpaid month first, and anything
            over becomes credit against the next one.
          </p>

          {selected.status !== 'CLOSED' ? (
            <ChargePanel
              periodId={selected.id}
              students={invoices.map((inv) => ({
                id: inv.student.id,
                label: `${inv.student.fullName} — ${inv.room.code}`,
              }))}
              rooms={rooms.map((r) => ({
                id: r.roomId,
                label: `${r.roomCode} — ${r.rows.length} student${r.rows.length === 1 ? '' : 's'}`,
              }))}
            />
          ) : null}
        </>
      )}
    </>
  );
}

function RoomGroup({ room, locked }) {
  const roomTotals = room.rows.reduce(
    (acc, i) => ({
      due: acc.due + i.totalPayable,
      paid: acc.paid + i.amountPaid,
      balance: acc.balance + i.closingBalance,
    }),
    { due: 0, paid: 0, balance: 0 },
  );

  return (
    <>
      {room.rows.map((inv, i) => (
        <tr key={inv.id}>
          <td className="num font-medium">
            {i === 0 ? `${room.roomCode}` : ''}
          </td>
          <td>
            <Link href={`/admin/students/${inv.student.id}/statement`} className="hover:underline">
              {inv.student.fullName}
            </Link>
          </td>
          <td className="right num">{fmt(inv.openingBalance)}</td>
          <td className="right num">{fmt(inv.rentShare)}</td>
          <td className="right num">{fmt(inv.chargesTotal)}</td>
          <td className="right num" title={inv.discountReason ?? undefined}>
            {inv.discount > 0 ? (
              <Link href={`/admin/students/${inv.student.id}/statement`} className="hover:underline">
                {fmt(inv.discount)}
              </Link>
            ) : fmt(0)}
          </td>
          <td className="right">
            {locked ? (
              <span className="num">{fmt(inv.amountPaid)}</span>
            ) : (
              <PaidCell
                studentId={inv.student.id}
                studentName={inv.student.fullName}
                amountPaid={inv.amountPaid}
              />
            )}
          </td>
          <td className="right num">{fmt(inv.closingBalance)}</td>
          <td className="text-sm">{STATUS_LABEL[inv.status] ?? inv.status}</td>
        </tr>
      ))}
      {room.rows.length > 1 ? (
        <tr className="text-ink-soft">
          <td></td>
          <td className="text-sm italic">Room {room.roomCode} total</td>
          <td></td>
          <td className="right num text-sm">{fmt(room.roomRent)}</td>
          <td></td>
          <td></td>
          <td className="right num text-sm">{fmt(roomTotals.paid)}</td>
          <td className="right num text-sm">{fmt(roomTotals.balance)}</td>
          <td></td>
        </tr>
      ) : null}
    </>
  );
}
