'use client';

import { useActionState, useState } from 'react';
import { grantRelief } from '@/actions/relief';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Agreeing a reduced rent for a run of months.
 *
 * The figure entered is what the student STILL PAYS, never "how much off".
 * "Half" and "three quarters" mean opposite things depending on which way round
 * you say them, and this is the screen where that ambiguity would turn into
 * real money going missing — so the wording, the buttons and the preview all
 * say the same thing.
 */
export default function ReliefPanel({ studentId, studentName }) {
  const [state, action] = useActionState(grantRelief, initial);
  const [payPercent, setPayPercent] = useState(50);
  const errors = state.errors ?? {};

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="studentId" value={studentId} />

      <div className="border-b border-rule pb-3">
        <p className="eyebrow">Agree</p>
        <h3 className="font-cond text-lg font-semibold">Reduced rent for a period</h3>
        <p className="mt-1 text-sm text-ink-soft">
          For a placement or attachment, set the months away and what {studentName} still
          pays. Every month in the range is reduced automatically — including
          months already invoiced.
        </p>
      </div>

      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="kind">Why</label>
          <select id="kind" name="kind" className="field" defaultValue="PLACEMENT">
            <option value="PLACEMENT">Placement / attachment</option>
            <option value="NEGOTIATED">Negotiated</option>
            <option value="HARDSHIP">Hardship</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="reason">Note for the record</label>
          <input
            id="reason"
            name="reason"
            className="field"
            placeholder="Attachment at Kisumu, agreed with the parent"
            required
            aria-invalid={errors.reason ? 'true' : undefined}
          />
          {errors.reason ? <p className="err">{errors.reason}</p> : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="label">First month away</span>
          <div className="flex gap-2">
            <select name="startMonth" className="field" defaultValue={month} aria-label="First month">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input
              name="startYear"
              type="number"
              className="field num w-24"
              defaultValue={year}
              min={2020}
              max={2100}
              aria-label="First year"
            />
          </div>
        </div>
        <div>
          <span className="label">Last month away</span>
          <div className="flex gap-2">
            <select name="endMonth" className="field" defaultValue={month} aria-label="Last month">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input
              name="endYear"
              type="number"
              className="field num w-24"
              defaultValue={year}
              min={2020}
              max={2100}
              aria-label="Last year"
            />
          </div>
          {errors.endMonth ? <p className="err">{errors.endMonth}</p> : (
            <p className="hint">Same month twice means a single month.</p>
          )}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="payPercent">
          What {studentName} still pays, per month
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { v: 75, l: 'Three quarters' },
            { v: 50, l: 'Half' },
            { v: 25, l: 'A quarter' },
            { v: 0, l: 'Nothing' },
          ].map(({ v, l }) => (
            <button
              key={v}
              type="button"
              onClick={() => setPayPercent(v)}
              className={`btn px-2.5 py-1 text-xs ${payPercent === v ? 'btn-primary' : 'btn-quiet'}`}
            >
              {l}
            </button>
          ))}
          <span className="flex items-center gap-1.5">
            <input
              id="payPercent"
              name="payPercent"
              type="number"
              className="field num w-20"
              value={payPercent}
              onChange={(e) => setPayPercent(Number(e.target.value))}
              min={0}
              max={100}
              required
              aria-invalid={errors.payPercent ? 'true' : undefined}
            />
            <span className="text-sm text-ink-soft">% of the normal share</span>
          </span>
        </div>
        {errors.payPercent ? <p className="err">{errors.payPercent}</p> : (
          <p className="hint">
            {payPercent === 100
              ? 'No reduction — they pay the full share.'
              : `They pay ${payPercent}% and the hostel absorbs the other ${100 - payPercent}%. Roommates pay exactly what they would have anyway.`}
          </p>
        )}
      </div>

      <SubmitButton className="btn btn-primary" pendingLabel="Saving…">
        Agree this arrangement
      </SubmitButton>
    </form>
  );
}
