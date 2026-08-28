'use client';

import { useActionState } from 'react';
import { signRules } from '@/actions/portal';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

/**
 * One button at the foot of the rules — §5.8. The confirmation replaces it, so
 * there is no doubt about whether the click registered.
 */
export default function SignRules({ title }) {
  const [state, action] = useActionState(signRules, initial);

  if (state.ok) {
    return (
      <div className="card border-paid/40 bg-paid-tint p-5">
        <p className="text-[15px] text-paid">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-5">
      <p className="text-[15px]">
        By clicking below you confirm that you have read and agree to the {title}.
      </p>
      {state.message ? (
        <div className="mt-3"><Notice tone="error">{state.message}</Notice></div>
      ) : null}
      <SubmitButton className="btn btn-primary mt-4" pendingLabel="Recording…">
        I have read and agree to these rules
      </SubmitButton>
      <p className="hint mt-2">
        The date and time are recorded. If the rules are revised you will be
        asked to agree again.
      </p>
    </form>
  );
}
