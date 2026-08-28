import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { fmt, ksh } from '@/lib/money';
import { formatDate, monthLabel } from '@/lib/dates';
import PageHeader from '@/components/PageHeader';
import ReliefPanel from './ReliefPanel';
import CancelReliefButton from './CancelReliefButton';
import DiscountCell from './DiscountCell';
import ChargeList from './ChargeList';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

const STATUS_LABEL = {
  PAID: 'Paid', PARTIAL: 'Part paid', UNPAID: 'Unpaid',
  OVERDUE: 'Overdue', WAIVED: 'Waived',
};
const METHOD_LABEL = { CASH: 'Cash', MPESA_TILL: 'M-Pesa Till', BANK: 'Bank' };
const KIND_LABEL = {
  PLACEMENT: 'Placement / attachment',
  NEGOTIATED: 'Negotiated',
  HARDSHIP: 'Hardship',
  OTHER: 'Other',
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id }, select: { fullName: true },
  });
  return { title: `${student?.fullName ?? 'Statement'} — statement` };
}

export default async function StatementPage({ params }) {
  const { id } = await params;
  const session = await auth();
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';

  const [student, settings] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        occupancies: {
          where: { status: 'ACTIVE' },
          include: { room: { select: { code: true, block: { select: { name: true } } } } },
          take: 1,
        },
        invoices: {
          include: {
            period: { select: { year: true, month: true, label: true, status: true } },
            charges: true,
            allocations: {
              include: {
                payment: { select: { receiptNo: true, method: true, paidAt: true, status: true } },
              },
            },
          },
        },
        payments: {
          where: { status: { in: ['APPROVED', 'REVERSED'] } },
          orderBy: { paidAt: 'desc' },
        },
        reliefs: { orderBy: { createdAt: 'desc' }, include: { approvedBy: { select: { name: true } } } },
      },
    }),
    prisma.settings.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!student) notFound();

  const invoices = [...student.invoices].sort(
    (a, b) => (a.period.year * 12 + a.period.month) - (b.period.year * 12 + b.period.month),
  );
  const room = student.occupancies[0]?.room;
  const balance = invoices.length > 0
    ? invoices[invoices.length - 1].closingBalance
    : student.openingBalance;

  const totals = invoices.reduce(
    (acc, i) => ({
      rent: acc.rent + i.rentShare,
      charges: acc.charges + i.chargesTotal,
      discount: acc.discount + i.discount,
      paid: acc.paid + i.amountPaid,
    }),
    { rent: 0, charges: 0, discount: 0, paid: 0 },
  );

  return (
    <>
      <PageHeader eyebrow="Statement" title={student.fullName}>
        <PrintButton />
        <a href={`/admin/students/${id}/statement/export`} className="btn btn-quiet">
          Export CSV
        </a>
        <Link href={`/admin/students/${id}`} className="btn btn-quiet no-print">
          Back to student
        </Link>
      </PageHeader>

      <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-4">
        <div>
          <p className="eyebrow">Room</p>
          <p className="num text-lg">{room ? `${room.code}` : '—'}</p>
          <p className="hint">{room ? `Block ${room.block.name}` : 'Not allocated'}</p>
        </div>
        <div>
          <p className="eyebrow">Brought forward</p>
          <p className="num text-lg">{fmt(student.openingBalance)}</p>
          <p className="hint">From the paper sheet</p>
        </div>
        <div>
          <p className="eyebrow">Total paid</p>
          <p className="num text-lg">{fmt(totals.paid)}</p>
          <p className="hint">{invoices.length} month(s) billed</p>
        </div>
        <div>
          <p className="eyebrow">{balance < 0 ? 'In credit' : 'Balance'}</p>
          <p className={`num text-lg font-semibold ${balance > 0 ? 'text-unpaid' : 'text-paid'}`}>
            {fmt(Math.abs(balance))}
          </p>
          <p className="hint">{balance > 0 ? 'Owing now' : balance < 0 ? 'Paid ahead' : 'Settled'}</p>
        </div>
      </div>

      <h2 className="font-cond text-lg font-semibold">Month by month</h2>
      <p className="hint mb-3">
        Each month opens with what was owed at the end of the month before, so a
        balance never has to be carried across by hand.
      </p>

      {invoices.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-ink-soft">
          Nothing billed yet. The first invoice will appear once a month is generated.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Month</th>
                <th className="right">Opening</th>
                <th className="right">Rent share</th>
                <th className="right">Charges</th>
                <th className="right">Discount</th>
                <th className="right">Payable</th>
                <th className="right">Paid</th>
                <th className="right">Closing</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <span className="font-medium">{inv.period.label}</span>
                    <span className="block text-xs text-ink-faint">{inv.invoiceNo}</span>
                    {inv.discountReason ? (
                      <span className="block text-xs text-enamel-dark">{inv.discountReason}</span>
                    ) : null}
                  </td>
                  <td className="right num">{fmt(inv.openingBalance)}</td>
                  <td className="right num">{fmt(inv.rentShare)}</td>
                  <td className="right">
                    <ChargeList
                      charges={inv.charges}
                      total={inv.chargesTotal}
                      canRemove={isSuperAdmin && inv.period.status !== 'CLOSED'}
                    />
                  </td>
                  <td className="right">
                    {isSuperAdmin && inv.period.status !== 'CLOSED' ? (
                      <DiscountCell
                        invoiceId={inv.id}
                        discount={inv.discount}
                        monthLabel={inv.period.label}
                        rentShare={inv.rentShare}
                      />
                    ) : (
                      <span className="num">{fmt(inv.discount)}</span>
                    )}
                  </td>
                  <td className="right num">{fmt(inv.totalPayable)}</td>
                  <td className="right num">{fmt(inv.amountPaid)}</td>
                  <td className="right num font-medium">{fmt(inv.closingBalance)}</td>
                  <td className="text-sm">{STATUS_LABEL[inv.status] ?? inv.status}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td>Totals</td>
                <td></td>
                <td className="right num">{fmt(totals.rent)}</td>
                <td className="right num">{fmt(totals.charges)}</td>
                <td className="right num">{fmt(totals.discount)}</td>
                <td></td>
                <td className="right num">{fmt(totals.paid)}</td>
                <td className="right num">{fmt(balance)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-cond text-lg font-semibold">Payments received</h2>
      {student.payments.length === 0 ? (
        <p className="hint">Nothing recorded yet.</p>
      ) : (
        <div className="card mt-2 overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Method</th>
                <th>Code</th>
                <th>Date</th>
                <th className="right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {student.payments.map((p) => (
                <tr key={p.id} className={p.status === 'REVERSED' ? 'text-ink-faint line-through' : undefined}>
                  <td className="num">{p.receiptNo ?? '—'}</td>
                  <td className="text-sm">{METHOD_LABEL[p.method] ?? p.method}</td>
                  <td className="num text-sm">{p.transactionCode ?? '—'}</td>
                  <td className="text-sm">{formatDate(p.paidAt)}</td>
                  <td className="right num">{fmt(p.amount)}</td>
                  <td className="text-sm">{p.status === 'REVERSED' ? 'Reversed' : 'Approved'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-cond text-lg font-semibold">Reduced-rent arrangements</h2>
      <p className="hint mb-3">
        Placement, attachment, or anything else agreed personally. The reduction
        comes off the hostel&rsquo;s income — roommates&rsquo; shares are untouched.
      </p>

      {student.reliefs.length > 0 ? (
        <div className="card mb-4 overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Months</th>
                <th className="right">Pays</th>
                <th>Reason</th>
                <th>Agreed by</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {student.reliefs.map((r) => {
                const from = monthLabel(r.startYear, r.startMonth);
                const to = monthLabel(r.endYear, r.endMonth);
                return (
                  <tr key={r.id} className={r.cancelledAt ? 'text-ink-faint line-through' : undefined}>
                    <td className="text-sm">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="text-sm">{from === to ? from : `${from} – ${to}`}</td>
                    <td className="right num">{r.payPercent}%</td>
                    <td className="text-sm">{r.reason}</td>
                    <td className="text-sm">{r.approvedBy?.name ?? '—'}</td>
                    <td className="right">
                      {isSuperAdmin && !r.cancelledAt ? (
                        <CancelReliefButton reliefId={r.id} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {isSuperAdmin ? (
        <ReliefPanel studentId={id} studentName={student.fullName} />
      ) : (
        <p className="hint">Only the proprietor can agree a reduced rent.</p>
      )}

      <p className="mt-8 hint">
        {settings?.hostelName ?? 'Lepamus Residency'} · statement produced {formatDate(new Date())}
        {settings?.tillNumber ? ` · Till ${settings.tillNumber}` : ''}
      </p>
    </>
  );
}
