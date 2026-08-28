import { redirect } from 'next/navigation';
import { currentStudent } from '@/auth';
import { prisma } from '@/lib/db';
import { portalSummary } from '@/lib/portal';
import { ksh, fmt } from '@/lib/money';
import { formatDate, nairobiToday } from '@/lib/dates';
import SubmitPaymentForm from './SubmitPaymentForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pay — Lepamus Residency' };

const STATUS_LABEL = {
  SUBMITTED: 'Being checked',
  APPROVED: 'Confirmed',
  REJECTED: 'Not found',
};

export default async function PayPage() {
  const me = await currentStudent();
  if (!me) redirect('/login');
  const [summary, settings] = await Promise.all([
    portalSummary(me.id),
    prisma.settings.findUnique({ where: { id: 'singleton' } }),
  ]);

  const { balance, payments, pendingClaim } = summary;
  const owing = balance > 0 ? balance : 0;
  const today = nairobiToday();

  return (
    <>
      <h1 className="font-cond text-2xl font-semibold tracking-tight">Paying your rent</h1>

      <div className="card mt-5 p-5">
        <p className="eyebrow">What you owe right now</p>
        <p className={`num mt-1 text-3xl font-semibold leading-none ${owing > 0 ? 'text-unpaid' : 'text-paid'}`}>
          {ksh(Math.abs(balance))}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {balance > 0
            ? 'This is the figure to pay.'
            : balance < 0
              ? 'You are paid ahead — nothing is due.'
              : 'Nothing outstanding.'}
        </p>
      </div>

      <section className="card mt-4 p-5">
        <h2 className="font-cond text-lg font-semibold">How to pay by M-Pesa</h2>
        <ol className="mt-3 space-y-2.5 text-[15px]">
          <li><span className="font-medium">1.</span> Open M-Pesa and choose <span className="font-medium">Lipa na M-Pesa</span>.</li>
          <li><span className="font-medium">2.</span> Choose <span className="font-medium">Buy Goods and Services</span>.</li>
          <li>
            <span className="font-medium">3.</span> Enter Till number{' '}
            <span className="num text-lg font-semibold">{settings?.tillNumber ?? '—'}</span>
          </li>
          <li>
            <span className="font-medium">4.</span> Enter the amount
            {owing > 0 ? <> — <span className="num font-semibold">{fmt(owing)}</span></> : null}
          </li>
          <li>
            <span className="font-medium">5.</span> Check the name reads{' '}
            <span className="font-semibold">{settings?.tillBusinessName ?? 'LEPAMUS RESIDENCY'}</span>{' '}
            before you enter your PIN.
          </li>
          <li><span className="font-medium">6.</span> Enter your PIN and keep the confirmation message.</li>
        </ol>
        <p className="hint mt-3">
          You can also pay cash at the office. Either way, the payment only
          changes your balance once the office has confirmed it.
        </p>
      </section>

      {pendingClaim ? (
        <div className="card mt-4 border-enamel/40 bg-enamel-tint p-5">
          <p className="font-medium text-enamel-dark">
            You have a payment being checked
          </p>
          <p className="mt-1 text-sm text-enamel-dark">
            {ksh(pendingClaim.amountClaimed ?? pendingClaim.amount)} paid{' '}
            {formatDate(pendingClaim.paidAt)}, code{' '}
            <span className="num">{pendingClaim.transactionCode}</span>. Please wait
            for the office rather than submitting it again.
          </p>
        </div>
      ) : (
        <SubmitPaymentForm
          today={`${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`}
          suggested={owing > 0 ? String(Math.round(owing / 100)) : ''}
        />
      )}

      {payments.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-cond text-lg font-semibold">What you have submitted</h2>
          <div className="card mt-2 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Date paid</th>
                  <th>Code</th>
                  <th className="right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-sm">{formatDate(p.paidAt)}</td>
                    <td className="num text-sm">{p.transactionCode ?? 'Cash'}</td>
                    <td className="right num">{fmt(p.amountClaimed ?? p.amount)}</td>
                    <td className="text-sm">
                      {STATUS_LABEL[p.status] ?? p.status}
                      {p.rejectionReason ? (
                        <span className="block text-xs text-unpaid">{p.rejectionReason}</span>
                      ) : null}
                    </td>
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
