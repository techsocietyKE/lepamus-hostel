'use client';

import { useActionState, useState } from 'react';
import { decideVacateRequest } from '@/actions/vacate';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';
import { ksh } from '@/lib/money';
import { formatDateTime } from '@/lib/dates';

const initial = { ok: null, message: null, errors: {} };

export default function VacateQueue({ requests }) {
  return (
    <div className="mt-3 space-y-4">
      {requests.map((r) => (
        <VacateCard key={r.id} request={r} />
      ))}
    </div>
  );
}

function VacateCard({ request }) {
  const [state, action] = useActionState(decideVacateRequest, initial);
  const [deciding, setDeciding] = useState(false);
  const errors = state.errors ?? {};

  if (state.ok) {
    return (
      <div className="card border-paid/40 bg-paid-tint p-5">
        <p className="text-[15px] text-paid">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
        <div>
          <p className="eyebrow">{request.studentPhone}</p>
          <h3 className="font-cond text-lg font-semibold">{request.studentName}</h3>
        </div>
        <p className="text-sm text-ink-soft">Requested {formatDateTime(request.requestedAt)}</p>
      </div>

      <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="eyebrow">Room</dt>
          <dd className="num">{request.roomCode} · {request.blockName}</dd>
        </div>
        <div>
          <dt className="eyebrow">Moving out</dt>
          <dd>{request.requestedDate}</dd>
        </div>
        <div>
          <dt className="eyebrow">Balance</dt>
          <dd className="num">{ksh(request.balance)}</dd>
        </div>
      </dl>

      {request.reason ? (
        <p className="mt-3 whitespace-pre-line border-l-2 border-rule pl-3 text-sm text-ink-soft">
          {request.reason}
        </p>
      ) : null}

      {state.message ? (
        <div className="mt-3">
          <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
        </div>
      ) : null}

      {!deciding ? (
        <div className="mt-4 flex gap-2 border-t border-rule pt-4">
          <button type="button" className="btn btn-primary" onClick={() => setDeciding(true)}>
            Approve
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setDeciding(true)}>
            Decline
          </button>
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-3 border-t border-rule pt-4">
          <input type="hidden" name="vacateId" value={request.id} />

          {errors.adminNotes ? <p className="err">{errors.adminNotes}</p> : null}

          <div>
            <label className="label" htmlFor={`note-${request.id}`}>Note to the student</label>
            <input
              id={`note-${request.id}`}
              name="adminNotes"
              className="field"
              placeholder="Settle your balance by the 5th"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="APPROVED" className="btn btn-primary" pendingLabel="Approving…">
              Approve
            </SubmitButton>
            <SubmitButton name="decision" value="REJECTED" className="btn btn-danger" pendingLabel="Declining…">
              Decline
            </SubmitButton>
            <button type="button" className="btn btn-quiet" onClick={() => setDeciding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
