'use client';

import { useActionState, useState } from 'react';
import { addCharge } from '@/actions/charges';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

const TYPES = [
  { v: 'DAMAGE', l: 'Damage' },
  { v: 'KEY', l: 'Key or lock' },
  { v: 'CLEANING', l: 'Cleaning' },
  { v: 'OTHER', l: 'Other' },
];

/**
 * Adding a one-off charge to this month. Water and electricity are in the rent
 * and never charged separately, so this is damage, keys, cleaning and the
 * occasional other thing.
 *
 * A room charge splits evenly across whoever is in it, which is what shared
 * damage needs — the alternative is the clerk dividing by three on paper.
 */
export default function ChargePanel({ periodId, students, rooms }) {
  const [state, action] = useActionState(addCharge, initial);
  const [target, setTarget] = useState('STUDENT');
  const [open, setOpen] = useState(false);
  const errors = state.errors ?? {};

  if (!open) {
    return (
      <div className="mt-4">
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(true)}>
          Add a charge
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="card mt-4 space-y-4 p-5">
      <input type="hidden" name="periodId" value={periodId} />

      <div className="flex items-start justify-between gap-3 border-b border-rule pb-3">
        <div>
          <p className="eyebrow">Add</p>
          <h2 className="font-cond text-lg font-semibold">A charge this month</h2>
        </div>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <fieldset>
        <legend className="label">Who pays it?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { v: 'STUDENT', l: 'One student' },
            { v: 'ROOM', l: 'Split across a room' },
          ].map(({ v, l }) => (
            <label
              key={v}
              className={`cursor-pointer rounded-sm border px-3 py-2 text-sm ${
                target === v
                  ? 'border-enamel bg-enamel-tint text-enamel-dark'
                  : 'border-rule text-ink-soft hover:bg-wall'
              }`}
            >
              <input
                type="radio"
                name="target"
                value={v}
                checked={target === v}
                onChange={() => setTarget(v)}
                className="sr-only"
              />
              {l}
            </label>
          ))}
        </div>
        {errors.target ? <p className="err">{errors.target}</p> : null}
      </fieldset>

      {target === 'STUDENT' ? (
        <div>
          <label className="label" htmlFor="studentId">Student</label>
          <select id="studentId" name="studentId" className="field" defaultValue="" required>
            <option value="" disabled>Choose a student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="roomId">Room</label>
          <select id="roomId" name="roomId" className="field" defaultValue="" required>
            <option value="" disabled>Choose a room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <p className="hint">
            Split evenly between everyone billed for that room this month, to the
            shilling, always summing to the amount entered.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className="label" htmlFor="description">What is it for?</label>
          <input
            id="description"
            name="description"
            className="field"
            placeholder="Broken window latch"
            required
            aria-invalid={errors.description ? 'true' : undefined}
          />
          {errors.description ? <p className="err">{errors.description}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input
            id="amount"
            name="amount"
            className="field num"
            inputMode="numeric"
            required
            aria-invalid={errors.amount ? 'true' : undefined}
          />
          {errors.amount ? <p className="err">{errors.amount}</p> : null}
        </div>
      </div>

      <fieldset>
        <legend className="label">Kind</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(({ v, l }, i) => (
            <label
              key={v}
              className="cursor-pointer rounded-sm border border-rule px-3 py-1.5 text-sm text-ink-soft hover:bg-wall has-[:checked]:border-enamel has-[:checked]:bg-enamel-tint has-[:checked]:text-enamel-dark"
            >
              <input
                type="radio"
                name="type"
                value={v}
                defaultChecked={i === 0}
                className="sr-only"
              />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton className="btn btn-primary" pendingLabel="Adding…">
        Add charge
      </SubmitButton>
    </form>
  );
}
