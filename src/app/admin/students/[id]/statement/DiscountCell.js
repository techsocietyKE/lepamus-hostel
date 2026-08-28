'use client';

import { useActionState, useState } from 'react';
import { adjustInvoice } from '@/actions/relief';
import SubmitButton from '@/components/SubmitButton';
import { fmt } from '@/lib/money';

const initial = { ok: null, message: null, errors: {} };

/**
 * A one-off "pay less this month", agreed at the counter. Separate from a
 * placement arrangement, which spans months and is set up once.
 */
export default function DiscountCell({ invoiceId, discount, monthLabel, rentShare }) {
  const [state, action] = useActionState(adjustInvoice, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="num underline decoration-dotted underline-offset-2 hover:text-enamel"
        onClick={() => setOpen(true)}
        title={`Reduce ${monthLabel} for this student`}
      >
        {fmt(discount)}
      </button>
    );
  }

  return (
    <form action={action} className="space-y-1.5 text-left">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="flex items-center gap-1.5">
        <input
          name="discount"
          className="field num w-20 py-1 text-right"
          defaultValue={Math.round(discount / 100)}
          inputMode="numeric"
          aria-label={`Discount for ${monthLabel}`}
        />
        <SubmitButton className="btn btn-primary px-2 py-1 text-xs" pendingLabel="…">
          Save
        </SubmitButton>
        <button
          type="button"
          className="btn btn-quiet px-2 py-1 text-xs"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
      <input
        name="reason"
        className="field w-full py-1 text-xs"
        placeholder="Why less this month?"
        required
        aria-label="Reason for the discount"
      />
      <p className="hint">
        Off a rent share of {fmt(rentShare)}. Enter 0 to remove a discount.
      </p>
      {state.message ? (
        <p className={state.ok ? 'hint' : 'err'}>{state.message}</p>
      ) : null}
    </form>
  );
}
