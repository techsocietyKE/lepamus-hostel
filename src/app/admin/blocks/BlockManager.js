'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createBlock, deleteBlock } from '@/actions/rooms';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

export default function BlockManager({ blocks }) {
  const [state, action] = useActionState(createBlock, initial);
  const [delState, delAction] = useActionState(deleteBlock, initial);
  const errors = state.errors ?? {};

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="card overflow-hidden">
        {blocks.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">
            No blocks yet. Add the first one alongside.
          </p>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Block</th>
                <th>Description</th>
                <th className="right">Rooms</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id}>
                  <td className="num font-medium">{b.name}</td>
                  <td className="text-ink-soft">{b.description || '—'}</td>
                  <td className="right num">{b._count.rooms}</td>
                  <td className="right">
                    {b._count.rooms === 0 ? (
                      <form action={delAction} className="inline">
                        <input type="hidden" name="id" value={b.id} />
                        <SubmitButton className="btn btn-danger px-2 py-1 text-xs" pendingLabel="…">
                          Remove
                        </SubmitButton>
                      </form>
                    ) : (
                      <Link
                        href={`/admin/rooms?block=${encodeURIComponent(b.name)}`}
                        className="text-sm text-enamel hover:underline"
                      >
                        View rooms
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {delState.message ? (
          <div className="border-t border-rule p-3">
            <Notice tone={delState.ok ? 'done' : 'error'}>{delState.message}</Notice>
          </div>
        ) : null}
      </div>

      <form action={action} className="card h-fit space-y-4 p-5">
        <div>
          <p className="eyebrow">Add</p>
          <h2 className="font-cond text-lg font-semibold">New block</h2>
        </div>

        {state.message ? (
          <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
        ) : null}

        <div>
          <label className="label" htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            className="field num uppercase"
            placeholder="A"
            maxLength={30}
            required
            aria-invalid={errors.name ? 'true' : undefined}
          />
          {errors.name ? <p className="err">{errors.name}</p>
            : <p className="hint">A letter or short name, as painted on the building.</p>}
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <input
            id="description"
            name="description"
            className="field"
            placeholder="Ground floor, east wing"
          />
        </div>

        <div>
          <label className="label" htmlFor="sortOrder">Order</label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            className="field"
            defaultValue={0}
            min={0}
            max={999}
          />
          <p className="hint">Lower numbers appear first in lists.</p>
        </div>

        <SubmitButton className="btn btn-primary w-full" pendingLabel="Adding…">
          Add block
        </SubmitButton>
      </form>
    </div>
  );
}
