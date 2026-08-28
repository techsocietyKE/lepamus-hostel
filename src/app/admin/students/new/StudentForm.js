'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createStudent } from '@/actions/students';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

export default function StudentForm() {
  const [state, action] = useActionState(createStudent, initial);
  const router = useRouter();
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.ok && state.studentId) {
      router.push(`/admin/students/${state.studentId}`);
    }
  }, [state.ok, state.studentId, router]);

  return (
    <form action={action} className="card max-w-xl space-y-4 p-5">
      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <div>
        <label className="label" htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          name="fullName"
          className="field"
          required
          autoFocus
          aria-invalid={errors.fullName ? 'true' : undefined}
        />
        {errors.fullName ? <p className="err">{errors.fullName}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            className="field num"
            placeholder="0712 345 678"
            required
            aria-invalid={errors.phone ? 'true' : undefined}
          />
          {errors.phone ? <p className="err">{errors.phone}</p>
            : <p className="hint">Used to sign in, and to trace a Till payment back.</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            aria-invalid={errors.email ? 'true' : undefined}
          />
          {errors.email ? <p className="err">{errors.email}</p>
            : <p className="hint">Optional. Lets them reset their own password.</p>}
        </div>
      </div>

      <fieldset>
        <legend className="label">Gender</legend>
        <div className="grid max-w-xs grid-cols-2 gap-2">
          {[{ v: 'MALE', l: 'Male' }, { v: 'FEMALE', l: 'Female' }].map((g, i) => (
            <label
              key={g.v}
              className="cursor-pointer rounded-sm border border-rule-strong px-3 py-1.5 text-center text-sm has-[:checked]:border-enamel has-[:checked]:bg-enamel-tint"
            >
              <input type="radio" name="gender" value={g.v} defaultChecked={i === 0} className="sr-only" />
              {g.l}
            </label>
          ))}
        </div>
        <p className="hint">Decides which rooms they can be put in.</p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="idNumber">ID or registration number</label>
          <input id="idNumber" name="idNumber" className="field num" />
        </div>
        <div>
          <label className="label" htmlFor="admittedAt">Date admitted</label>
          <input id="admittedAt" name="admittedAt" type="date" className="field" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="institution">Institution</label>
          <input id="institution" name="institution" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="course">Course</label>
          <input id="course" name="course" className="field" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nextOfKinName">Next of kin</label>
          <input id="nextOfKinName" name="nextOfKinName" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="nextOfKinPhone">Their phone</label>
          <input
            id="nextOfKinPhone"
            name="nextOfKinPhone"
            className="field num"
            aria-invalid={errors.nextOfKinPhone ? 'true' : undefined}
          />
          {errors.nextOfKinPhone ? <p className="err">{errors.nextOfKinPhone}</p> : null}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="openingBalance">Balance brought forward</label>
        <input
          id="openingBalance"
          name="openingBalance"
          className="field num"
          inputMode="numeric"
          placeholder="0"
          aria-invalid={errors.openingBalance ? 'true' : undefined}
        />
        {errors.openingBalance ? <p className="err">{errors.openingBalance}</p> : (
          <p className="hint">
            What they owed on the last paper sheet. Leave at 0 for a new student.
            A negative figure means they have paid ahead. This carries into their
            first invoice and cannot be changed once billing has started.
          </p>
        )}
      </div>

      <SubmitButton className="btn btn-primary w-full" pendingLabel="Adding…">
        Add student
      </SubmitButton>
      <p className="hint">You can put them in a room on the next screen.</p>
    </form>
  );
}
