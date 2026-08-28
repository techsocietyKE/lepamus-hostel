'use client';

import { useActionState, useState } from 'react';
import { recordCashPayment, recordTillPayment } from '@/actions/payments';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';
import StudentPicker from './StudentPicker';

const initial = { ok: null, message: null, errors: {} };

/**
 * Recording a payment the office has already seen — cash in hand, or an arrival
 * on the Till. Both are approved as they are entered: the clerk is either
 * holding the money or looking at the Till record.
 *
 * The two methods share a form because they share most of their fields, and
 * because an office that has to find a different screen for cash will keep
 * using paper for cash.
 */
export default function RecordPaymentForm({ students, tillNumber, today }) {
  const [method, setMethod] = useState('CASH');
  const [cashState, cashAction] = useActionState(recordCashPayment, initial);
  const [tillState, tillAction] = useActionState(recordTillPayment, initial);

  const isCash = method === 'CASH';
  const state = isCash ? cashState : tillState;
  const action = isCash ? cashAction : tillAction;
  const errors = state.errors ?? {};

  return (
    <form action={action} className="card h-fit space-y-4 p-5">
      <div className="border-b border-rule pb-3">
        <p className="eyebrow">Record</p>
        <h2 className="font-cond text-lg font-semibold">A payment received</h2>
      </div>

      <fieldset>
        <legend className="label">How was it paid?</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: 'CASH', l: 'Cash at the office' },
            { v: 'MPESA_TILL', l: 'M-Pesa Till' },
          ].map(({ v, l }) => (
            <label
              key={v}
              className={`cursor-pointer rounded-sm border px-3 py-2 text-sm ${
                method === v
                  ? 'border-enamel bg-enamel-tint text-enamel-dark'
                  : 'border-rule text-ink-soft hover:bg-wall'
              }`}
            >
              <input
                type="radio"
                name="method"
                value={v}
                checked={method === v}
                onChange={() => setMethod(v)}
                className="sr-only"
              />
              {l}
            </label>
          ))}
        </div>
        {!isCash && tillNumber ? (
          <p className="hint">
            Till <span className="num font-medium">{tillNumber}</span>. Enter what you
            can see on the Till record.
          </p>
        ) : null}
      </fieldset>

      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <StudentPicker students={students} error={errors.studentId} />

      {!isCash ? (
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
            : <p className="hint">Ten letters and numbers, from the M-Pesa message. The same code cannot be used twice.</p>}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input
            id="amount"
            name="amount"
            className="field num"
            inputMode="numeric"
            required
            aria-invalid={errors.amount ? 'true' : undefined}
          />
          {errors.amount ? <p className="err">{errors.amount}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="paidAt">Date paid</label>
          <input
            id="paidAt"
            name="paidAt"
            type="date"
            className="field"
            defaultValue={today}
            required
            aria-invalid={errors.paidAt ? 'true' : undefined}
          />
          {errors.paidAt ? <p className="err">{errors.paidAt}</p> : null}
        </div>
      </div>

      {!isCash ? (
        <div>
          <label className="label" htmlFor="payerPhone">Paid from (optional)</label>
          <input
            id="payerPhone"
            name="payerPhone"
            className="field num"
            placeholder="0712 345 678"
            aria-invalid={errors.payerPhone ? 'true' : undefined}
          />
          {errors.payerPhone ? <p className="err">{errors.payerPhone}</p>
            : <p className="hint">Useful when a parent paid on the student&rsquo;s behalf.</p>}
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="note">Note (optional)</label>
        <input
          id="note"
          name="note"
          className="field"
          placeholder={isCash ? 'Paid at the desk, receipt book 14' : 'Anything worth recording'}
        />
      </div>

      <SubmitButton className="btn btn-primary w-full" pendingLabel="Recording…">
        {isCash ? 'Record cash payment' : 'Record Till payment'}
      </SubmitButton>
      <p className="hint">
        {isCash
          ? 'Approved as you record it — you are holding the money. It settles the oldest unpaid month first.'
          : 'Approved as you record it, the same as cash — you are looking at the Till record as you type.'}
      </p>
    </form>
  );
}
