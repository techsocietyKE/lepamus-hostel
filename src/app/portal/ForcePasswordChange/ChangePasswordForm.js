'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { changePasswordAction } from '@/actions/portal';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

export default function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initial);
  const errors = state.errors ?? {};

  if (state.ok) {
    return (
      <div className="mt-6 space-y-3">
        <Notice tone="done">{state.message}</Notice>
        <Link href="/portal" className="btn btn-primary w-full">Continue to your account</Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.message ? (
        <Notice tone="error">{state.message}</Notice>
      ) : null}

      <div>
        <label className="label" htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          className="field"
          minLength={6}
          required
          autoComplete="new-password"
          aria-invalid={errors.newPassword ? 'true' : undefined}
        />
        {errors.newPassword ? <p className="err">{errors.newPassword}</p>
          : <p className="hint">At least 6 characters.</p>}
      </div>

      <div>
        <label className="label" htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="field"
          minLength={6}
          required
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? 'true' : undefined}
        />
        {errors.confirmPassword ? <p className="err">{errors.confirmPassword}</p> : null}
      </div>

      <SubmitButton className="btn btn-primary w-full" pendingLabel="Saving…">
        Change password
      </SubmitButton>
    </form>
  );
}
