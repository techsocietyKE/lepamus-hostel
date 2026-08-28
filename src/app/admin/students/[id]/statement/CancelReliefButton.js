'use client';

import { useActionState } from 'react';
import { cancelRelief } from '@/actions/relief';
import SubmitButton from '@/components/SubmitButton';

const initial = { ok: null, message: null, errors: {} };

/** Cancelling puts the full share back on every month the arrangement covered. */
export default function CancelReliefButton({ reliefId }) {
  const [state, action] = useActionState(cancelRelief, initial);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="reliefId" value={reliefId} />
      <SubmitButton className="btn btn-quiet px-2 py-1 text-xs" pendingLabel="…">
        Cancel
      </SubmitButton>
      {state.message && !state.ok ? <p className="err">{state.message}</p> : null}
    </form>
  );
}
