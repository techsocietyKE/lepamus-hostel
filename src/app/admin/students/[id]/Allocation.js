'use client';

import { useActionState, useState } from 'react';
import { allocateRoom, endOccupancy, transferRoom, setStudentStatus } from '@/actions/students';
import { splitRent, fmt } from '@/lib/money';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

function RoomPicker({ rooms, name = 'roomId', onPick }) {
  return (
    <select
      id={name}
      name={name}
      className="field"
      required
      defaultValue=""
      onChange={(e) => onPick?.(e.target.value)}
    >
      <option value="" disabled>Choose a room…</option>
      {rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {r.code} — block {r.block} · {r.occupied}/{r.capacity} · {' '}
          {r.gender === 'ANY' ? 'any gender' : r.gender === 'MALE' ? 'men' : 'women'}
        </option>
      ))}
    </select>
  );
}

export default function Allocation({ student, current, rooms, today }) {
  const [allocState, allocAction] = useActionState(allocateRoom, initial);
  const [endState, endAction] = useActionState(endOccupancy, initial);
  const [moveState, moveAction] = useActionState(transferRoom, initial);
  const [statusState, statusAction] = useActionState(setStudentStatus, initial);

  const [picked, setPicked] = useState('');
  const [showMove, setShowMove] = useState(false);

  const pickedRoom = rooms.find((r) => r.id === picked);
  const previewShare = pickedRoom
    ? splitRent(pickedRoom.monthlyRent, pickedRoom.occupied + 1)[0]
    : null;

  if (current) {
    return (
      <div className="space-y-4">
        <div className="card space-y-3 p-5">
          <div>
            <p className="eyebrow">Currently in</p>
            <h2 className="font-cond text-xl font-semibold">
              Room {current.code}
              <span className="ml-2 text-base font-normal text-ink-faint">block {current.block}</span>
            </h2>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Since</dt>
              <dd>{current.startDate}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">People in the room</dt>
              <dd className="num">{current.occupants}/{current.capacity}</dd>
            </div>
            <div className="flex justify-between border-t border-rule pt-1.5">
              <dt className="text-ink-soft">Their share this month</dt>
              <dd className="num font-medium">KSh {fmt(current.share)}</dd>
            </div>
          </dl>
        </div>

        {moveState.message ? (
          <Notice tone={moveState.ok ? 'done' : 'error'}>{moveState.message}</Notice>
        ) : null}

        {showMove ? (
          <form action={moveAction} className="card space-y-3 p-5">
            <p className="eyebrow">Move room</p>
            <input type="hidden" name="occupancyId" value={current.occupancyId} />
            <div>
              <label className="label" htmlFor="roomId">New room</label>
              <RoomPicker rooms={rooms.filter((r) => r.id !== current.roomId)} />
            </div>
            <div>
              <label className="label" htmlFor="moveDate">From</label>
              <input id="moveDate" name="startDate" type="date" className="field" defaultValue={today} />
            </div>
            <p className="hint">
              This month&rsquo;s bill stays with room {current.code}. The new share starts next month.
            </p>
            <div className="flex gap-2">
              <SubmitButton className="btn btn-primary flex-1" pendingLabel="Moving…">Move</SubmitButton>
              <button type="button" className="btn btn-quiet" onClick={() => setShowMove(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn-quiet w-full" onClick={() => setShowMove(true)}>
            Move to another room
          </button>
        )}

        <div className="card space-y-3 p-5">
          <p className="eyebrow">Move out</p>
          {endState.message ? (
            <Notice tone={endState.ok ? 'done' : 'error'}>{endState.message}</Notice>
          ) : null}
          <form action={endAction} className="space-y-3">
            <input type="hidden" name="occupancyId" value={current.occupancyId} />
            <input type="hidden" name="endReason" value="VACATED" />
            <div>
              <label className="label" htmlFor="endDate">Last day</label>
              <input id="endDate" name="endDate" type="date" className="field" defaultValue={today} />
            </div>
            <p className="hint">
              Closes the occupancy and frees the bed. Any balance stays on their record.
            </p>
            <SubmitButton className="btn btn-danger w-full" pendingLabel="Recording…">
              Record move-out
            </SubmitButton>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={allocAction} className="card space-y-4 p-5">
        <div>
          <p className="eyebrow">Housing</p>
          <h2 className="font-cond text-lg font-semibold">Put in a room</h2>
        </div>

        {allocState.message ? (
          <Notice tone={allocState.ok ? 'done' : 'error'}>{allocState.message}</Notice>
        ) : null}

        {rooms.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No room with space is open to this student. Add a room, free a bed, or
            set a room to take any gender.
          </p>
        ) : (
          <>
            <input type="hidden" name="studentId" value={student.id} />
            <div>
              <label className="label" htmlFor="roomId">Room</label>
              <RoomPicker rooms={rooms} onPick={setPicked} />
              <p className="hint">Only rooms with space that accept this student are listed.</p>
            </div>

            {pickedRoom ? (
              <div className="rounded-sm bg-wall px-3 py-2 text-xs text-ink-soft">
                Room rent KSh {fmt(pickedRoom.monthlyRent)} divided among{' '}
                {pickedRoom.occupied + 1} occupant{pickedRoom.occupied ? 's' : ''} —{' '}
                <span className="num font-medium text-ink">KSh {fmt(previewShare)}</span> each.
              </div>
            ) : null}

            <div>
              <label className="label" htmlFor="startDate">Moving in on</label>
              <input id="startDate" name="startDate" type="date" className="field" defaultValue={today} required />
            </div>

            <SubmitButton className="btn btn-primary w-full" pendingLabel="Allocating…">
              Allocate room
            </SubmitButton>
          </>
        )}
      </form>

      {student.status !== 'ACTIVE' ? (
        <form action={statusAction} className="card space-y-3 p-5">
          <p className="eyebrow">Status</p>
          {statusState.message ? (
            <Notice tone={statusState.ok ? 'done' : 'error'}>{statusState.message}</Notice>
          ) : null}
          <p className="text-sm text-ink-soft">
            This student is not marked active. Set them back to active to house them again.
          </p>
          <input type="hidden" name="id" value={student.id} />
          <input type="hidden" name="status" value="ACTIVE" />
          <SubmitButton className="btn btn-quiet w-full" pendingLabel="Updating…">
            Mark as active
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
