'use client';

import { useActionState } from 'react';
import { submitVacateRequest } from '@/actions/portal';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

/** A student's notice that they are leaving — §5.7. */
export default function VacateForm({ today }) {
  const [state, action] = useActionState(submitVacateRequest, initial);
  const errors = state.errors ?? {};

  if (state.ok) {
    return (
      <div className="card mt-4 border-paid/40 bg-paid-tint p-5">
        <p className="text-[15px] text-paid">{state.message}</p>
        <p className="hint mt-1">
          Your balance is recorded as it was when you asked. The office will
          confirm with you.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card mt-4 space-y-4 p-5">
      <div className="border-b border-rule pb-3">
        <h2 className="font-cond text-lg font-semibold">Tell us when you are leaving</h2>
        <p className="mt-1 text-sm text-ink-soft">
          This is a request, not a confirmation. The office will confirm with you
          and settle your balance. Your balance is recorded as it is now.
        </p>
      </div>

      {state.message ? (
        <Notice tone="error">{state.message}</Notice>
      ) : null}

      <div>
        <label className="label" htmlFor="requestedDate">Moving out on</label>
        <input
          id="requestedDate"
          name="requestedDate"
          type="date"
          className="field"
          defaultValue={today}
          min={today}
          required
          aria-invalid={errors.requestedDate ? 'true' : undefined}
        />
        {errors.requestedDate ? <p className="err">{errors.requestedDate}</p> : null}
      </div>

      <div>
        <label className="label" htmlFor="reason">Reason</label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          className="field"
          placeholder="Why are you leaving?"
          required
          aria-invalid={errors.reason ? 'true' : undefined}
        />
        {errors.reason ? <p className="err">{errors.reason}</p> : null}
      </div>

      <SubmitButton className="btn btn-primary w-full" pendingLabel="Sending…">
        Request to vacate
      </SubmitButton>
    </form>
  );
}
