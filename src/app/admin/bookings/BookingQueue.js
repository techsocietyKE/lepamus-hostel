'use client';

import { useActionState, useState } from 'react';
import { approveBooking, decideBooking } from '@/actions/bookings';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

const GENDER_LABEL = { MALE: 'Male', FEMALE: 'Female' };

export default function BookingQueue({ bookings, rooms, today }) {
  return (
    <div className="mt-3 space-y-4">
      {bookings.map((b) => (
        <BookingCard key={b.id} booking={b} rooms={rooms} today={today} />
      ))}
    </div>
  );
}

function BookingCard({ booking, rooms, today }) {
  const [approveState, approveAction] = useActionState(approveBooking, initial);
  const [decideState, decideAction] = useActionState(decideBooking, initial);
  const [closing, setClosing] = useState(false);

  // Rooms this person could actually go in — a men's room is never offered for
  // a woman, so the refusal cannot happen after the decision has been made.
  const usable = rooms.filter((r) => r.gender === 'ANY' || r.gender === booking.gender);

  if (approveState.ok && approveState.credentials) {
    const c = approveState.credentials;
    return (
      <div className="card border-paid/40 p-5">
        <p className="eyebrow">Approved</p>
        <h3 className="font-cond text-lg font-semibold">{c.name} is in room {c.roomCode}</h3>
        <p className="mt-2 text-sm">{approveState.message}</p>

        <div className="mt-4 rounded-sm border border-rule bg-wall p-4">
          <p className="eyebrow">Give them these once</p>
          <dl className="mt-1.5 space-y-1 text-sm">
            <div className="flex gap-3">
              <dt className="min-w-24 text-ink-soft">Sign in with</dt>
              <dd className="num font-medium">{c.phone}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="min-w-24 text-ink-soft">Password</dt>
              <dd className="num text-base font-semibold tracking-wide">{c.password}</dd>
            </div>
          </dl>
          <p className="hint mt-2">
            They are asked to change it at their first sign-in. This password is
            not stored anywhere readable, so it cannot be shown again — write it
            down or send it now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
        <div>
          <p className="eyebrow">
            {booking.reference}
            {booking.status === 'WAITLISTED' ? ' · waiting list' : ''}
          </p>
          <h3 className="font-cond text-lg font-semibold">{booking.fullName}</h3>
        </div>
        <p className="text-sm text-ink-soft">
          Enquired {booking.waitingSince}
          {booking.ageDays >= 2 ? (
            <span className="block text-xs text-unpaid">
              waiting {booking.ageDays} days
            </span>
          ) : null}
        </p>
      </div>

      <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="eyebrow">Phone</dt>
          <dd className="num">{booking.phone}</dd>
        </div>
        <div>
          <dt className="eyebrow">Wants</dt>
          <dd>{booking.categoryName ?? 'No preference'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Gender</dt>
          <dd>{GENDER_LABEL[booking.gender] ?? booking.gender}</dd>
        </div>
        {booking.requestedRoom ? (
          <div>
            <dt className="eyebrow">Room they want</dt>
            <dd className="num font-medium text-enamel">{booking.requestedRoom}</dd>
          </div>
        ) : null}
        {booking.email ? (
          <div>
            <dt className="eyebrow">Email</dt>
            <dd className="break-all">{booking.email}</dd>
          </div>
        ) : null}
        {booking.institution ? (
          <div>
            <dt className="eyebrow">Institution</dt>
            <dd>{booking.institution}</dd>
          </div>
        ) : null}
        {booking.desiredMoveIn ? (
          <div>
            <dt className="eyebrow">Wants to move in</dt>
            <dd>{booking.desiredMoveIn}</dd>
          </div>
        ) : null}
      </dl>

      {booking.message ? (
        <p className="mt-3 whitespace-pre-line border-l-2 border-rule pl-3 text-sm text-ink-soft">
          {booking.message}
        </p>
      ) : null}

      {approveState.message && !approveState.ok ? (
        <div className="mt-3"><Notice tone="error">{approveState.message}</Notice></div>
      ) : null}
      {decideState.message ? (
        <div className="mt-3">
          <Notice tone={decideState.ok ? 'done' : 'error'}>{decideState.message}</Notice>
        </div>
      ) : null}

      {usable.length === 0 ? (
        <Notice tone="error">
          No {GENDER_LABEL[booking.gender]?.toLowerCase()} room has a free bed at the
          moment. Put them on the waiting list, or free a bed first.
        </Notice>
      ) : (
        <form action={approveAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-rule pt-4">
          <input type="hidden" name="bookingId" value={booking.id} />
          <div className="min-w-44">
            <label className="label" htmlFor={`room-${booking.id}`}>Give them</label>
            <select id={`room-${booking.id}`} name="roomId" className="field" required defaultValue="">
              <option value="" disabled>Choose a room</option>
              {usable.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`start-${booking.id}`}>From</label>
            <input
              id={`start-${booking.id}`}
              name="startDate"
              type="date"
              className="field"
              defaultValue={today}
              required
            />
          </div>
          <SubmitButton className="btn btn-primary" pendingLabel="Approving…">
            Approve and allocate
          </SubmitButton>
        </form>
      )}

      <div className="mt-3">
        {closing ? (
          <form action={decideAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="bookingId" value={booking.id} />
            <div className="min-w-64 flex-1">
              <label className="label" htmlFor={`note-${booking.id}`}>Note (optional)</label>
              <input id={`note-${booking.id}`} name="note" className="field" placeholder="Nothing free until January" />
            </div>
            <button
              type="submit"
              name="status"
              value="WAITLISTED"
              className="btn btn-quiet"
            >
              Waiting list
            </button>
            <button
              type="submit"
              name="status"
              value="REJECTED"
              className="btn btn-danger"
            >
              Close enquiry
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setClosing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setClosing(true)}>
            Cannot take them
          </button>
        )}
      </div>
    </div>
  );
}
