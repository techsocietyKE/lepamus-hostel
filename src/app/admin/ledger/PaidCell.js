'use client';

import { useActionState, useEffect, useRef } from 'react';
import { recordCashPayment } from '@/actions/payments';
import SubmitButton from '@/components/SubmitButton';
import { fmt } from '@/lib/money';

const initial = { ok: null, message: null, errors: {} };

/**
 * The Paid column of the paper sheet, made editable — §5.7. Cash is approved as
 * it is entered, because the clerk is holding the money.
 *
 * The Save button is deliberately always visible rather than appearing on
 * focus. §1.4 assumes staff who know a paper ledger and a phone, not software
 * conventions: "press Enter" is a convention, and a button that only appears
 * once you have already started typing is no more discoverable than no button.
 */
export default function PaidCell({ studentId, studentName, amountPaid }) {
  const [state, action] = useActionState(recordCashPayment, initial);
  const inputRef = useRef(null);

  useEffect(() => {
    if (state.ok && inputRef.current) inputRef.current.value = '';
  }, [state]);

  return (
    <div className="min-w-52">
      <form action={action} className="flex items-center justify-end gap-1.5">
        <input type="hidden" name="studentId" value={studentId} />
        <span className="num mr-1 text-ink-faint" title="Paid so far this month">
          {fmt(amountPaid)}
        </span>
        <input
          ref={inputRef}
          name="amount"
          className="field num w-20 py-1 text-right"
          inputMode="numeric"
          placeholder="Amount"
          aria-label={`Cash received from ${studentName}`}
          aria-invalid={state.ok === false ? 'true' : undefined}
        />
        <SubmitButton className="btn btn-quiet px-2.5 py-1 text-xs" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>
      {state.message ? (
        <p className={`${state.ok ? 'hint' : 'err'} text-right`}>
          {state.ok ? '✓ ' : ''}{state.message}
        </p>
      ) : null}
    </div>
  );
}
