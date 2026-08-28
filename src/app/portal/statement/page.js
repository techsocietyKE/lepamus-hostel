import { redirect } from 'next/navigation';
import { currentStudent } from '@/auth';
import { portalSummary } from '@/lib/portal';
import { fmt } from '@/lib/money';
import { formatDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Statement — Lepamus Residency' };

const STATUS_LABEL = {
  PAID: 'Paid', PARTIAL: 'Part paid', UNPAID: 'Unpaid',
  OVERDUE: 'Overdue', WAIVED: 'Waived',
};

export default async function PortalStatement() {
  const me = await currentStudent();
  if (!me) redirect('/login');
  const { invoices, balance, payments } = await portalSummary(me.id);

  const approved = payments.filter((p) => p.status === 'APPROVED');

  return (
    <>
      <h1 className="font-cond text-2xl font-semibold tracking-tight">Your statement</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Every month since you moved in. Each one starts with whatever was left
        over from the month before.
      </p>

      {invoices.length === 0 ? (
        <div className="card mt-5 px-6 py-10 text-center text-sm text-ink-soft">
          Nothing has been billed yet.
        </div>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Month</th>
                <th className="right">Brought forward</th>
                <th className="right">Rent</th>
                <th className="right">Charges</th>
                <th className="right">Reduction</th>
                <th className="right">Paid</th>
                <th className="right">Left to pay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <span className="font-medium">{inv.period.label}</span>
                    {inv.discountReason ? (
                      <span className="block text-xs text-enamel-dark">{inv.discountReason}</span>
                    ) : null}
                  </td>
                  <td className="right num">{fmt(inv.openingBalance)}</td>
                  <td className="right num">{fmt(inv.rentShare)}</td>
                  <td className="right num">{fmt(inv.chargesTotal)}</td>
                  <td className="right num">{fmt(inv.discount)}</td>
                  <td className="right num">{fmt(inv.amountPaid)}</td>
                  <td className="right num font-medium">{fmt(inv.closingBalance)}</td>
                  <td className="text-sm">{STATUS_LABEL[inv.status] ?? inv.status}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={6}>{balance < 0 ? 'In credit' : 'Balance now'}</td>
                <td className="right num">{fmt(Math.abs(balance))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {approved.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-cond text-lg font-semibold">Your receipts</h2>
          <div className="card mt-2 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Code</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((p) => (
                  <tr key={p.id}>
                    <td className="num text-sm">{p.receiptNo ?? '—'}</td>
                    <td className="text-sm">{formatDate(p.paidAt)}</td>
                    <td className="num text-sm">{p.transactionCode ?? 'Cash'}</td>
                    <td className="right num">{fmt(p.amount)}</td>
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
