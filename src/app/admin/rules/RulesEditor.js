'use client';

import { useActionState } from 'react';
import { publishRules } from '@/actions/rules';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

const STARTER = `1. Rent is due by the fifth of each month.
2. Quiet hours are from 10pm to 6am.
3. Visitors must be signed in at the office and may not stay overnight.
4. Damage to hostel property is charged to the room.
5. Cooking is only permitted in the shared kitchen.
6. Keys must be returned when vacating. A lost key is charged for.
7. A month's notice is required before vacating.`;

export default function RulesEditor({ current }) {
  const [state, action] = useActionState(publishRules, initial);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="card space-y-4 p-5">
      <div className="border-b border-rule pb-3">
        <p className="eyebrow">{current ? 'Revise' : 'Write'}</p>
        <h2 className="font-cond text-lg font-semibold">
          {current ? `Publish version ${current.version + 1}` : 'Publish the rules'}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Editing here does not change what anyone has already agreed to.
          Publishing creates a new version and asks every resident to sign it
          again; the old text and its signatures stay on record.
        </p>
      </div>

      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <div>
        <label className="label" htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          className="field"
          defaultValue={current?.title ?? 'Hostel Rules and Regulations'}
          required
          aria-invalid={errors.title ? 'true' : undefined}
        />
        {errors.title ? <p className="err">{errors.title}</p> : null}
      </div>

      <div>
        <label className="label" htmlFor="content">The rules</label>
        <textarea
          id="content"
          name="content"
          rows={18}
          className="field font-mono text-[13px] leading-relaxed"
          defaultValue={current?.content ?? STARTER}
          required
          aria-invalid={errors.content ? 'true' : undefined}
        />
        {errors.content ? <p className="err">{errors.content}</p>
          : <p className="hint">One rule per line. Blank lines separate paragraphs.</p>}
      </div>

      <SubmitButton className="btn btn-primary" pendingLabel="Publishing…">
        {current ? `Publish version ${current.version + 1}` : 'Publish the rules'}
      </SubmitButton>
    </form>
  );
}
