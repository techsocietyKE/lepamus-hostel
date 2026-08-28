'use client';

import { useActionState, useState } from 'react';
import { approvePayment, rejectPayment, bulkApprovePayments } from '@/actions/payments';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';
import { fmt } from '@/lib/money';

const initial = { ok: null, message: null, errors: {} };

const REJECT_REASONS = [
  'No payment with that code at the Till',
  'Amount does not match the Till',
  'Code already used for another payment',
  'Paid to the wrong number',
];

/**
 * The second screen the office uses daily. Each row carries what the clerk
 * needs to decide without leaving it: the code, the claim, the balance now, and
 * the balance if approved.
 */
export default function VerifyQueue({ rows, staleAfterDays }) {
  const [bulkState, bulkAction] = useActionState(bulkApprovePayments, initial);

  return (
    <div className="space-y-3">
      {/* Kept outside the table so the per-row forms below are never nested
          inside it — the checkboxes reach it by id instead. */}
      <form id="bulk-approve" action={bulkAction} className="flex items-center gap-3">
        <SubmitButton className="btn btn-quiet" pendingLabel="Approving…">
          Approve ticked
        </SubmitButton>
        <span className="hint">
          Tick the ones you have already found on the Till, then approve them together.
        </span>
      </form>

      {bulkState.message ? (
        <Notice tone={bulkState.ok ? 'done' : 'error'}>{bulkState.message}</Notice>
      ) : null}

      <div className="card overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              <th></th>
              <th>Student</th>
              <th>Room</th>
              <th>Code</th>
              <th>Paid on</th>
              <th className="right">Claimed</th>
              <th className="right">Balance now</th>
              <th className="right">If approved</th>
              <th>Decide</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <QueueRow key={row.id} row={row} staleAfterDays={staleAfterDays} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QueueRow({ row, staleAfterDays }) {
  const [approveState, approveAction] = useActionState(approvePayment, initial);
  const [rejectState, rejectAction] = useActionState(rejectPayment, initial);
  const [rejecting, setRejecting] = useState(false);

  return (
    <>
      <tr className={row.stale ? 'bg-unpaid-tint' : undefined}>
        <td>
          <input
            type="checkbox"
            name="paymentIds"
            value={row.id}
            form="bulk-approve"
            className="size-4"
            aria-label={`Select ${row.studentName}'s payment`}
          />
        </td>
        <td>
          {row.studentName}
          {row.stale ? (
            <span className="block text-xs text-unpaid">
              waiting {row.ageDays} day{row.ageDays === 1 ? '' : 's'} — over the {staleAfterDays}-day limit
            </span>
          ) : null}
          {row.payerPhone ? (
            <span className="block text-xs text-ink-faint">paid from {row.payerPhone}</span>
          ) : null}
        </td>
        <td className="num">{row.roomCode}</td>
        <td className="num text-sm">{row.transactionCode ?? '—'}</td>
        <td className="text-sm">{row.paidAt}</td>
        <td className="right num">{fmt(row.claimed)}</td>
        <td className="right num">{fmt(row.balance)}</td>
        <td className="right num font-medium">{fmt(row.wouldBecome)}</td>
        <td>
          <div className="flex items-center gap-1.5">
            <form action={approveAction} className="flex items-center gap-1.5">
              <input type="hidden" name="paymentId" value={row.id} />
              <input
                name="amount"
                className="field num w-20 py-1 text-right"
                defaultValue={Math.round(row.claimed / 100)}
                aria-label={`Amount to approve for ${row.studentName}`}
              />
              <SubmitButton className="btn btn-primary px-2.5 py-1 text-xs" pendingLabel="…">
                Approve
              </SubmitButton>
            </form>
            <button
              type="button"
              className="btn btn-quiet px-2.5 py-1 text-xs"
              onClick={() => setRejecting((v) => !v)}
              aria-expanded={rejecting}
            >
              Reject
            </button>
          </div>
        </td>
      </tr>

      {rejecting ? (
        <tr>
          <td colSpan={9} className="bg-wall">
            <form action={rejectAction} className="flex flex-wrap items-center gap-2 py-1">
              <input type="hidden" name="paymentId" value={row.id} />
              <label className="label mb-0" htmlFor={`reason-${row.id}`}>
                Why — {row.studentName} will see this
              </label>
              <input
                id={`reason-${row.id}`}
                name="reason"
                className="field w-80"
                list={`reasons-${row.id}`}
                placeholder="Choose one or type your own"
                required
              />
              <datalist id={`reasons-${row.id}`}>
                {REJECT_REASONS.map((r) => <option key={r} value={r} />)}
              </datalist>
              <SubmitButton className="btn btn-danger px-2.5 py-1 text-xs" pendingLabel="…">
                Confirm rejection
              </SubmitButton>
              <button
                type="button"
                className="btn btn-quiet px-2.5 py-1 text-xs"
                onClick={() => setRejecting(false)}
              >
                Cancel
              </button>
            </form>
          </td>
        </tr>
      ) : null}

      {approveState.message || rejectState.message ? (
        <tr>
          <td colSpan={9}>
            <Notice tone={(approveState.ok ?? rejectState.ok) ? 'done' : 'error'}>
              {approveState.message || rejectState.message}
            </Notice>
          </td>
        </tr>
      ) : null}
    </>
  );
}
