'use client';

import { useActionState, useState } from 'react';
import { reversePayment } from '@/actions/payments';
import SubmitButton from '@/components/SubmitButton';

const initial = { ok: null, message: null, errors: {} };

/**
 * Reversing puts the money back on the student's balance. It is deliberately
 * two steps — a reason is required, and the original entry stays visible.
 */
export default function ReverseButton({ paymentId, studentName, amount }) {
  const [state, action] = useActionState(reversePayment, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-quiet px-2 py-1 text-xs"
        onClick={() => setOpen(true)}
      >
        Reverse
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input
        name="reason"
        className="field w-48 py-1 text-xs"
        placeholder={`Why reverse ${amount} for ${studentName}?`}
        required
        aria-label="Reason for reversal"
      />
      <SubmitButton className="btn btn-danger px-2 py-1 text-xs" pendingLabel="…">
        Confirm
      </SubmitButton>
      <button
        type="button"
        className="btn btn-quiet px-2 py-1 text-xs"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
      {state.message && !state.ok ? (
        <p className="err w-full text-right">{state.message}</p>
      ) : null}
    </form>
  );
}
