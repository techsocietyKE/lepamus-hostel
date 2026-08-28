'use client';

import { useActionState } from 'react';
import { submitPayment } from '@/actions/portal';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

/**
 * Telling the office you have paid. Worded throughout so nobody expects their
 * balance to move: this is a claim, and it is checked.
 */
export default function SubmitPaymentForm({ today, suggested }) {
  const [state, action] = useActionState(submitPayment, initial);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="card mt-4 space-y-4 p-5">
      <div className="border-b border-rule pb-3">
        <h2 className="font-cond text-lg font-semibold">Tell us you have paid</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Once you have paid the Till, enter the details from your M-Pesa
          message. The office checks it and confirms — your balance changes then,
          not now.
        </p>
      </div>

      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <div>
        <label className="label" htmlFor="transactionCode">M-Pesa code</label>
        <input
          id="transactionCode"
          name="transactionCode"
          className="field num uppercase"
          placeholder="TGH4X8K2LM"
          maxLength={10}
          required
          aria-invalid={errors.transactionCode ? 'true' : undefined}
        />
        {errors.transactionCode ? <p className="err">{errors.transactionCode}</p>
          : <p className="hint">The ten characters at the start of your M-Pesa message.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="amount">Amount you paid</label>
          <input
            id="amount"
            name="amount"
            className="field num"
            inputMode="numeric"
            defaultValue={suggested}
            required
            aria-invalid={errors.amount ? 'true' : undefined}
          />
          {errors.amount ? <p className="err">{errors.amount}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="paidAt">Date you paid</label>
          <input
            id="paidAt"
            name="paidAt"
            type="date"
            className="field"
            defaultValue={today}
            max={today}
            required
            aria-invalid={errors.paidAt ? 'true' : undefined}
          />
          {errors.paidAt ? <p className="err">{errors.paidAt}</p> : null}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="payerPhone">Paid from another number?</label>
        <input
          id="payerPhone"
          name="payerPhone"
          className="field num"
          placeholder="0712 345 678"
          aria-invalid={errors.payerPhone ? 'true' : undefined}
        />
        {errors.payerPhone ? <p className="err">{errors.payerPhone}</p>
          : <p className="hint">Only if somebody else paid for you — a parent, for instance.</p>}
      </div>

      <SubmitButton className="btn btn-primary w-full" pendingLabel="Sending…">
        Submit for checking
      </SubmitButton>
    </form>
  );
}
