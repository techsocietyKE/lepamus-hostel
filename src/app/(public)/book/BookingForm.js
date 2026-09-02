'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { submitBooking } from '@/actions/bookings';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

export default function BookingForm({ categories, preselected, preselectedRoom, holdDays }) {
  const [state, action] = useActionState(submitBooking, initial);
  const errors = state.errors ?? {};

  // The confirmation replaces the form: §5.10 wants a reference number and a
  // plain statement that nothing is confirmed and no payment is due.
  if (state.ok && state.reference) {
    return (
      <div className="card mt-6 p-6">
        <p className="eyebrow">Enquiry received</p>
        <h2 className="font-cond text-2xl font-semibold">{state.reference}</h2>
        <p className="mt-3 text-[15px]">{state.message}</p>
        <p className="mt-3 text-sm text-ink-soft">
          Keep that reference — quoting it saves time when you ring. Once the
          office approves your enquiry they will assign a room and hold it for{' '}
          {holdDays} days.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/rules" className="btn btn-primary">Read the rules</Link>
          <Link href="/" className="btn btn-quiet">Back to the homepage</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card mt-6 space-y-4 p-5">
      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <input type="hidden" name="requestedRoomCode" value={preselectedRoom} />

      {preselectedRoom ? (
        <div className="rounded-sm border border-enamel/30 bg-enamel-tint px-3 py-2 text-sm text-enamel-dark">
          You are enquiring about room{' '}
          <span className="num font-medium">{preselectedRoom}</span>.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="fullName">Your name</label>
          <input
            id="fullName"
            name="fullName"
            className="field"
            required
            autoComplete="name"
            aria-invalid={errors.fullName ? 'true' : undefined}
          />
          {errors.fullName ? <p className="err">{errors.fullName}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            className="field num"
            placeholder="0712 345 678"
            required
            autoComplete="tel"
            aria-invalid={errors.phone ? 'true' : undefined}
          />
          {errors.phone ? <p className="err">{errors.phone}</p>
            : <p className="hint">This is how the office will reach you.</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">Email (optional)</label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : undefined}
          />
          {errors.email ? <p className="err">{errors.email}</p> : null}
        </div>
        <fieldset>
          <legend className="label">You are</legend>
          <div className="flex gap-2">
            {[{ v: 'MALE', l: 'Male' }, { v: 'FEMALE', l: 'Female' }].map(({ v, l }) => (
              <label
                key={v}
                className="flex-1 cursor-pointer rounded-sm border border-rule px-3 py-2 text-center text-sm text-ink-soft hover:bg-wall has-[:checked]:border-enamel has-[:checked]:bg-enamel-tint has-[:checked]:text-enamel-dark"
              >
                <input type="radio" name="gender" value={v} required className="sr-only" />
                {l}
              </label>
            ))}
          </div>
          {errors.gender ? <p className="err">{errors.gender}</p>
            : <p className="hint">Rooms are set as men&rsquo;s, women&rsquo;s or mixed.</p>}
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="categoryId">Room type you want</label>
          <select
            id="categoryId"
            name="categoryId"
            className="field"
            defaultValue={preselected}
          >
            <option value="">No preference</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="desiredMoveIn">When you would move in</label>
          <input id="desiredMoveIn" name="desiredMoveIn" type="date" className="field" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="institution">Institution (optional)</label>
        <input id="institution" name="institution" className="field" />
      </div>

      <div>
        <label className="label" htmlFor="message">Anything else?</label>
        <textarea id="message" name="message" rows={3} className="field" />
      </div>

      <SubmitButton className="btn btn-primary w-full" pendingLabel="Sending…">
        Send enquiry
      </SubmitButton>
      <p className="hint">
        No payment is required now, and sending this does not commit you to
        anything.
      </p>
    </form>
  );
}
