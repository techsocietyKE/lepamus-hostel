'use client';

import { useActionState } from 'react';
import { releaseExpiredHoldsAction } from '@/actions/bookings';
import SubmitButton from '@/components/SubmitButton';

const initial = { ok: null, message: null, errors: {} };

/**
 * Opening this page already releases holds that have run out. The button is
 * for when someone wants to be certain rather than assume.
 */
export default function HoldSweeper() {
  const [state, action] = useActionState(releaseExpiredHoldsAction, initial);

  return (
    <form action={action} className="flex items-center gap-2">
      <SubmitButton className="btn btn-quiet" pendingLabel="Checking…">
        Release expired holds
      </SubmitButton>
      {state.message ? (
        <span className={state.ok ? 'hint' : 'err'}>{state.message}</span>
      ) : null}
    </form>
  );
}
