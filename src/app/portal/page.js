import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentStudent } from '@/auth';
import { portalSummary, rulesState } from '@/lib/portal';
import { fmt, ksh } from '@/lib/money';
import { formatDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account — Lepamus Residency' };

export default async function PortalHome() {
  const me = await currentStudent();
  if (!me) redirect('/login');
  const [summary, rules] = await Promise.all([
    portalSummary(me.id),
    rulesState(me.id),
  ]);

  const { room, balance, latest, roommates, roomTotal, pendingClaim } = summary;
  const owing = balance > 0;

  return (
    <>
      {rules.rules && !rules.signed ? (
        <div className="card mb-6 border-enamel/40 bg-enamel-tint p-5">
          <p className="font-cond text-lg font-semibold text-enamel-dark">
            Please read and agree to the hostel rules
          </p>
          <p className="mt-1 text-sm text-enamel-dark">
            You can look around in the meantime — this stays here until you have
            signed.
          </p>
          <Link href="/portal/rules" className="btn btn-primary mt-3">Read the rules</Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="eyebrow">{owing ? 'You owe' : balance < 0 ? 'You are in credit' : 'Your balance'}</p>
          <p className={`num mt-1 text-3xl font-semibold leading-none ${owing ? 'text-unpaid' : 'text-paid'}`}>
            {ksh(Math.abs(balance))}
          </p>
          {latest ? (
            <p className="mt-2 text-sm text-ink-soft">
              As at {latest.period.label}
              {owing && latest.dueDate ? <> · was due {formatDate(latest.dueDate)}</> : null}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Nothing has been billed yet.</p>
          )}
          {owing ? (
            <Link href="/portal/pay" className="btn btn-primary mt-4">How to pay</Link>
          ) : null}
        </div>

        <div className="card p-5">
          <p className="eyebrow">Your room</p>
          {room ? (
            <>
              <p className="num mt-1 text-3xl font-semibold leading-none">{room.code}</p>
              <p className="mt-2 text-sm text-ink-soft">
                Block {room.block.name} · {room.capacity} bed{room.capacity === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Since {formatDate(summary.occupancy.startDate)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">You are not in a room at the moment.</p>
          )}
        </div>
      </div>

      {pendingClaim ? (
        <div className="card mt-4 p-5">
          <p className="eyebrow">Awaiting confirmation</p>
          <p className="mt-1 text-[15px]">
            You submitted <span className="num font-medium">{ksh(pendingClaim.amountClaimed ?? pendingClaim.amount)}</span>{' '}
            on {formatDate(pendingClaim.paidAt)}
            {pendingClaim.transactionCode ? <> · code <span className="num">{pendingClaim.transactionCode}</span></> : null}.
          </p>
          <p className="hint mt-1">
            Your balance above does not include it yet. The office checks it
            against the Till and it is added once confirmed.
          </p>
        </div>
      ) : null}

      {roommates.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-cond text-lg font-semibold">
            Room {room?.code} this month
          </h2>
          <p className="hint mb-2">
            Who has settled and who has not. You can see the share and whether it
            is paid — nothing else about their account.
          </p>
          <div className="card overflow-hidden">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Who</th>
                  <th className="right">Share</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {roommates.map((r) => (
                  <tr key={r.id}>
                    <td>{r.isYou ? <span className="font-medium">You</span> : r.name}</td>
                    <td className="right num">{fmt(r.share)}</td>
                    <td className="text-sm">
                      <span className={`pill ${r.settled ? 'pill-paid' : 'pill-out'}`}>
                        {r.settled ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td>Room total</td>
                  <td className="right num">{fmt(roomTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      <p className="mt-8 text-sm text-ink-soft">
        Something wrong? Speak to the office — every figure here can be traced
        back to a receipt.
      </p>
    </>
  );
}
