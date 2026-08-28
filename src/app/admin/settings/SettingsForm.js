'use client';

import { useActionState } from 'react';
import { updateSettings } from '@/actions/settings';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

function Field({ id, label, hint, error, children }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="err">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export default function SettingsForm({ settings, contactPhoneDisplay }) {
  const [state, action] = useActionState(updateSettings, initial);
  const errors = state.errors ?? {};
  const invalid = (k) => (errors[k] ? 'true' : undefined);

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <section className="card space-y-4 p-5">
        <div className="border-b border-rule pb-3">
          <p className="eyebrow">Payment</p>
          <h2 className="font-cond text-lg font-semibold">M-Pesa Till</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Students pay this number through the ordinary Lipa na M-Pesa Buy
            Goods menu. The business name must read exactly as it does on the
            M-Pesa confirmation, so a student can tell they are paying the right
            place before entering their PIN.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tillNumber" label="Till number" error={errors.tillNumber}
            hint="Shown on the portal, the booking approval and the public site.">
            <input id="tillNumber" name="tillNumber" className="field num" inputMode="numeric"
              defaultValue={settings.tillNumber} required aria-invalid={invalid('tillNumber')} />
          </Field>

          <Field id="tillBusinessName" label="Business name" error={errors.tillBusinessName}
            hint="As M-Pesa displays it, in capitals.">
            <input id="tillBusinessName" name="tillBusinessName" className="field uppercase"
              defaultValue={settings.tillBusinessName} required aria-invalid={invalid('tillBusinessName')} />
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="border-b border-rule pb-3">
          <p className="eyebrow">Money</p>
          <h2 className="font-cond text-lg font-semibold">Due date and grace</h2>
          <p className="mt-1 text-sm text-ink-soft">
            There is no late fee. After the grace period an invoice becomes
            overdue and both sides are alerted — the status changes, the money
            never does.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="rentDueDay" label="Rent due on day" error={errors.rentDueDay}
            hint="1 to 28, so the date exists in February too.">
            <input id="rentDueDay" name="rentDueDay" type="number" className="field num"
              defaultValue={settings.rentDueDay} min={1} max={28} required
              aria-invalid={invalid('rentDueDay')} />
          </Field>

          <Field id="graceDays" label="Grace period (days)" error={errors.graceDays}
            hint="Overdue on the day after this runs out.">
            <input id="graceDays" name="graceDays" type="number" className="field num"
              defaultValue={settings.graceDays} min={0} max={31} required
              aria-invalid={invalid('graceDays')} />
          </Field>

          <Field id="staleClaimDays" label="Claim goes stale after (days)" error={errors.staleClaimDays}
            hint="A submitted payment waiting longer than this is highlighted for the office.">
            <input id="staleClaimDays" name="staleClaimDays" type="number" className="field num"
              defaultValue={settings.staleClaimDays} min={1} max={30} required
              aria-invalid={invalid('staleClaimDays')} />
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="border-b border-rule pb-3">
          <p className="eyebrow">Rooms</p>
          <h2 className="font-cond text-lg font-semibold">Bookings and turnover</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="bookingHoldDays" label="Hold a booking for (days)" error={errors.bookingHoldDays}
            hint="After this the bed is released and returns to the website automatically.">
            <input id="bookingHoldDays" name="bookingHoldDays" type="number" className="field num"
              defaultValue={settings.bookingHoldDays} min={1} max={30} required
              aria-invalid={invalid('bookingHoldDays')} />
          </Field>

          <Field id="cleaningDelayDays" label="Cleaning delay (days)" error={errors.cleaningDelayDays}
            hint="How long a vacated bed waits before it is listed again. Zero re-lists it at once.">
            <input id="cleaningDelayDays" name="cleaningDelayDays" type="number" className="field num"
              defaultValue={settings.cleaningDelayDays} min={0} max={30} required
              aria-invalid={invalid('cleaningDelayDays')} />
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="border-b border-rule pb-3">
          <p className="eyebrow">Public</p>
          <h2 className="font-cond text-lg font-semibold">Hostel and contact</h2>
        </div>

        <Field id="hostelName" label="Hostel name" error={errors.hostelName}
          hint="Used on the website and at the head of every printed sheet.">
          <input id="hostelName" name="hostelName" className="field"
            defaultValue={settings.hostelName} required aria-invalid={invalid('hostelName')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contactPhone" label="Contact phone" error={errors.contactPhone}
            hint={contactPhoneDisplay ? `Currently ${contactPhoneDisplay}.` : 'Optional. Also used for the WhatsApp link.'}>
            <input id="contactPhone" name="contactPhone" className="field num"
              defaultValue={settings.contactPhone ?? ''} placeholder="0712 345 678"
              aria-invalid={invalid('contactPhone')} />
          </Field>

          <Field id="contactEmail" label="Contact email" error={errors.contactEmail} hint="Optional.">
            <input id="contactEmail" name="contactEmail" type="email" className="field"
              defaultValue={settings.contactEmail ?? ''} aria-invalid={invalid('contactEmail')} />
          </Field>
        </div>

        <Field id="location" label="Location" error={errors.location}
          hint="Shown on the homepage — the area, and the walk to the nearby institution.">
          <textarea id="location" name="location" rows={2} className="field"
            defaultValue={settings.location ?? ''} aria-invalid={invalid('location')} />
        </Field>
      </section>

      <section className="card space-y-3 p-5">
        <div className="border-b border-rule pb-3">
          <p className="eyebrow">Alerts</p>
          <h2 className="font-cond text-lg font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Overdue rent and payment decisions always appear inside the system
            for both sides. These switches only add a message on top.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="smsEnabled" defaultChecked={settings.smsEnabled} className="size-4" />
          Send SMS notifications
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="emailEnabled" defaultChecked={settings.emailEnabled} className="size-4" />
          Send email notifications
        </label>
      </section>

      <div className="flex justify-end">
        <SubmitButton className="btn btn-primary" pendingLabel="Saving…">
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}
