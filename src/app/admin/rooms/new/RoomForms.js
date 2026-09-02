'use client';

import { useActionState, useState } from 'react';
import { createRoom, createRoomRange } from '@/actions/rooms';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

const GENDERS = [
  { value: 'ANY', label: 'Any', hint: 'Open to all' },
  { value: 'MALE', label: 'Men', hint: 'Men only' },
  { value: 'FEMALE', label: 'Women', hint: 'Women only' },
];

function GenderChoice({ errors }) {
  return (
    <fieldset>
      <legend className="label">Gender</legend>
      <div className="grid grid-cols-3 gap-2">
        {GENDERS.map((g, i) => (
          <label
            key={g.value}
            className="flex cursor-pointer flex-col rounded-sm border border-rule-strong px-3 py-2 text-sm has-[:checked]:border-enamel has-[:checked]:bg-enamel-tint"
          >
            <input
              type="radio"
              name="gender"
              value={g.value}
              defaultChecked={i === 0}
              className="sr-only"
            />
            <span className="font-medium">{g.label}</span>
            <span className="text-xs text-ink-faint">{g.hint}</span>
          </label>
        ))}
      </div>
      {errors.gender ? <p className="err">{errors.gender}</p> : null}
    </fieldset>
  );
}

function CapacityAndRent({ errors, capacityName = 'capacity' }) {
  const [capacity, setCapacity] = useState(2);
  const [rent, setRent] = useState('');

  const cents = Number(String(rent).replace(/[^0-9.]/g, '')) || 0;
  const perHead = capacity > 0 && cents > 0 ? Math.floor(cents / capacity) : null;
  const category = capacity === 1 ? 'Single' : `${capacity} Sharing`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={capacityName}>Capacity</label>
          <input
            id={capacityName}
            name={capacityName}
            type="number"
            inputMode="numeric"
            className="field"
            min={1}
            max={12}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value) || 1)}
            required
            aria-invalid={errors.capacity ? 'true' : undefined}
          />
          {errors.capacity ? <p className="err">{errors.capacity}</p>
            : <p className="hint">Beds. Listed as {category}.</p>}
        </div>

        <div>
          <label className="label" htmlFor="monthlyRent">Monthly rent</label>
          <input
            id="monthlyRent"
            name="monthlyRent"
            inputMode="numeric"
            className="field"
            placeholder="3000"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            required
            aria-invalid={errors.monthlyRent ? 'true' : undefined}
          />
          {errors.monthlyRent ? <p className="err">{errors.monthlyRent}</p>
            : <p className="hint">Whole room, not per bed.</p>}
        </div>
      </div>

      {perHead ? (
        <p className="rounded-sm bg-wall px-3 py-2 text-xs text-ink-soft">
          At {capacity} occupant{capacity === 1 ? '' : 's'} each pays{' '}
          <span className="num font-medium text-ink">
            KSh {perHead.toLocaleString('en-KE')}
          </span>
          . With fewer people in the room, each pays more.
        </p>
      ) : null}
    </>
  );
}

export default function RoomForms({ blocks }) {
  const [mode, setMode] = useState('single');
  const [single, singleAction] = useActionState(createRoom, initial);
  const [range, rangeAction] = useActionState(createRoomRange, initial);

  const state = mode === 'single' ? single : range;
  const errors = state.errors ?? {};

  if (blocks.length === 0) {
    return (
      <Notice tone="info">
        Create a block first — every room belongs to one.
      </Notice>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="mb-5 inline-flex rounded-sm border border-rule-strong p-0.5">
        {[
          { key: 'single', label: 'One room' },
          { key: 'range', label: 'A run of rooms' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMode(t.key)}
            className={`rounded-[2px] px-3 py-1.5 text-sm ${
              mode === t.key ? 'bg-enamel text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {state.message ? (
        <div className="mb-4">
          <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
        </div>
      ) : null}

      {mode === 'single' ? (
        <form key="single" action={singleAction} className="card space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="blockId">Block</label>
              <select id="blockId" name="blockId" className="field" required>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="code">Room number</label>
              <input
                id="code"
                name="code"
                className="field num uppercase"
                placeholder="A1"
                required
                aria-invalid={errors.code ? 'true' : undefined}
              />
              {errors.code ? <p className="err">{errors.code}</p> : null}
            </div>
          </div>

          <CapacityAndRent errors={errors} />
          <GenderChoice errors={errors} />

          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="field"
              placeholder="Optional. Shown on the website."
            />
          </div>

          <div>
            <label className="label" htmlFor="images">Room photograph</label>
            <input
              id="images"
              name="images"
              type="file"
              multiple
              accept="image/*"
              className="field"
              aria-invalid={errors.images ? 'true' : undefined}
            />
            {errors.images ? <p className="err">{errors.images}</p>
              : <p className="hint">A photo of this actual room, not the type. Up to 12.</p>}
          </div>

          <SubmitButton className="btn btn-primary w-full" pendingLabel="Adding…">
            Add room
          </SubmitButton>
        </form>
      ) : (
        <form key="range" action={rangeAction} className="card space-y-4 p-5">
          <p className="text-sm text-ink-soft">
            Creates every room in a numbered run with the same values. Numbers
            that already exist are skipped, so you can run it again after
            extending a block. Edit afterwards any room that differs.
          </p>

          <div>
            <label className="label" htmlFor="rangeBlock">Block</label>
            <select id="rangeBlock" name="blockId" className="field" required>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="prefix">Prefix</label>
              <input
                id="prefix"
                name="prefix"
                className="field num uppercase"
                placeholder="A"
                required
                aria-invalid={errors.prefix ? 'true' : undefined}
              />
            </div>
            <div>
              <label className="label" htmlFor="from">From</label>
              <input id="from" name="from" type="number" className="field" placeholder="1" min={0} required />
            </div>
            <div>
              <label className="label" htmlFor="to">To</label>
              <input
                id="to"
                name="to"
                type="number"
                className="field"
                placeholder="5"
                min={0}
                required
                aria-invalid={errors.to ? 'true' : undefined}
              />
              {errors.to ? <p className="err">{errors.to}</p> : null}
            </div>
          </div>
          <p className="hint -mt-2">Prefix A, 1 to 5 creates A1, A2, A3, A4, A5.</p>

          <CapacityAndRent errors={errors} />
          <GenderChoice errors={errors} />

          <div>
            <label className="label" htmlFor="rangeDescription">Description</label>
            <textarea
              id="rangeDescription"
              name="description"
              rows={2}
              className="field"
              placeholder="Optional. Applied to every room in the run."
            />
          </div>

          <SubmitButton className="btn btn-primary w-full" pendingLabel="Adding…">
            Add the rooms
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
