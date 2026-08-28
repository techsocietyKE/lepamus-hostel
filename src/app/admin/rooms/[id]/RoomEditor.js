'use client';

import { useActionState } from 'react';
import { updateRoom, setRoomStatus, deleteRoom } from '@/actions/rooms';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

const GENDERS = [
  { value: 'ANY', label: 'Any' },
  { value: 'MALE', label: 'Men' },
  { value: 'FEMALE', label: 'Women' },
];

export default function RoomEditor({ room, blocks, occupied, isSuperAdmin }) {
  const [state, action] = useActionState(updateRoom, initial);
  const [statusState, statusAction] = useActionState(setRoomStatus, initial);
  const [delState, delAction] = useActionState(deleteRoom, initial);
  const errors = state.errors ?? {};

  // Money is stored in cents; the form works in shillings.
  const rentShillings = String(Math.round(room.monthlyRent / 100));

  return (
    <div className="space-y-4">
      <form action={action} className="card space-y-4 p-5">
        <div>
          <p className="eyebrow">Edit</p>
          <h2 className="font-cond text-lg font-semibold">Room details</h2>
        </div>

        {state.message ? (
          <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
        ) : null}

        <input type="hidden" name="id" value={room.id} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="blockId">Block</label>
            <select id="blockId" name="blockId" className="field" defaultValue={room.blockId}>
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
              defaultValue={room.code}
              required
              aria-invalid={errors.code ? 'true' : undefined}
            />
            {errors.code ? <p className="err">{errors.code}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="capacity">Capacity</label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              className="field"
              min={1}
              max={12}
              defaultValue={room.capacity}
              required
              aria-invalid={errors.capacity ? 'true' : undefined}
            />
            {errors.capacity ? <p className="err">{errors.capacity}</p>
              : occupied > 0 ? <p className="hint">{occupied} in the room now.</p> : null}
          </div>
          <div>
            <label className="label" htmlFor="monthlyRent">Monthly rent</label>
            <input
              id="monthlyRent"
              name="monthlyRent"
              inputMode="numeric"
              className="field"
              defaultValue={rentShillings}
              required
              disabled={!isSuperAdmin}
              aria-invalid={errors.monthlyRent ? 'true' : undefined}
            />
            {errors.monthlyRent ? <p className="err">{errors.monthlyRent}</p>
              : !isSuperAdmin ? <p className="hint">Only the proprietor changes prices.</p> : null}
          </div>
        </div>

        <fieldset>
          <legend className="label">Gender</legend>
          <div className="grid grid-cols-3 gap-2">
            {GENDERS.map((g) => (
              <label
                key={g.value}
                className="cursor-pointer rounded-sm border border-rule-strong px-3 py-1.5 text-center text-sm has-[:checked]:border-enamel has-[:checked]:bg-enamel-tint"
              >
                <input
                  type="radio"
                  name="gender"
                  value={g.value}
                  defaultChecked={room.gender === g.value}
                  className="sr-only"
                />
                {g.label}
              </label>
            ))}
          </div>
          {occupied > 0 ? (
            <p className="hint">Changing this does not move anyone already here.</p>
          ) : null}
        </fieldset>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            rows={2}
            className="field"
            defaultValue={room.description}
          />
        </div>

        <SubmitButton className="btn btn-primary w-full" pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </form>

      <div className="card space-y-3 p-5">
        <div>
          <p className="eyebrow">Availability</p>
          <h2 className="font-cond text-base font-semibold">Take the room in or out of use</h2>
        </div>

        {statusState.message ? (
          <Notice tone={statusState.ok ? 'done' : 'error'}>{statusState.message}</Notice>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {[
            { value: 'ACTIVE', label: 'In use' },
            { value: 'MAINTENANCE', label: 'Under maintenance' },
            { value: 'INACTIVE', label: 'Out of use' },
          ].map((s) => (
            <form key={s.value} action={statusAction}>
              <input type="hidden" name="id" value={room.id} />
              <input type="hidden" name="status" value={s.value} />
              <SubmitButton
                className={`btn ${room.status === s.value ? 'btn-primary' : 'btn-quiet'}`}
                pendingLabel="…"
                disabled={room.status === s.value}
              >
                {s.label}
              </SubmitButton>
            </form>
          ))}
        </div>
        <p className="hint">
          A room with students in it cannot be taken out of use until they are moved.
        </p>
      </div>

      {isSuperAdmin ? (
        <div className="card space-y-3 p-5">
          <p className="eyebrow">Remove</p>
          {delState.message ? (
            <Notice tone={delState.ok ? 'done' : 'error'}>{delState.message}</Notice>
          ) : null}
          <p className="text-sm text-ink-soft">
            A room that has never been lived in can be deleted — that is a typo.
            Anything with history is taken out of use instead, so past records stay intact.
          </p>
          <form action={delAction}>
            <input type="hidden" name="id" value={room.id} />
            <SubmitButton className="btn btn-danger" pendingLabel="Deleting…">
              Delete room {room.code}
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
