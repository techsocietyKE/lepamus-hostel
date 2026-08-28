'use client';

import { useActionState } from 'react';
import { resetStudentPassword } from '@/actions/students';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

/** Recovery for a sign-in password nobody wrote down. */
export default function PasswordReset({ studentId }) {
  const [state, action] = useActionState(resetStudentPassword, initial);

  if (state.ok && state.credentials) {
    return (
      <div className="rounded-sm border border-rule bg-wall p-4">
        <p className="eyebrow">Give them these once</p>
        <dl className="mt-1.5 space-y-1 text-sm">
          <div className="flex gap-3">
            <dt className="min-w-24 text-ink-soft">Sign in with</dt>
            <dd className="num font-medium">{state.credentials.phone}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="min-w-24 text-ink-soft">Password</dt>
            <dd className="num text-base font-semibold tracking-wide">
              {state.credentials.password}
            </dd>
          </div>
        </dl>
        <p className="hint mt-2">
          They change it at their next sign-in. It cannot be shown again.
        </p>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="studentId" value={studentId} />
      <SubmitButton className="btn btn-quiet w-full" pendingLabel="Generating…">
        Reset sign-in password
      </SubmitButton>
      {state.message && !state.ok ? (
        <div className="mt-2"><Notice tone="error">{state.message}</Notice></div>
      ) : null}
    </form>
  );
}
