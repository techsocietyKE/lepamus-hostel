'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { openPeriod, generateInvoices } from '@/actions/billing';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PeriodBar({ periods, selected, defaults }) {
  const router = useRouter();
  const [openState, openAction] = useActionState(openPeriod, initial);
  const [genState, genAction] = useActionState(generateInvoices, initial);
  const errors = openState.errors ?? {};

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-end gap-4 p-4">
        {periods.length > 0 ? (
          <div className="min-w-48">
            <label className="label" htmlFor="period">Month</label>
            <select
              id="period"
              className="field"
              defaultValue={selected?.id ?? ''}
              onChange={(e) => router.push(`/admin/ledger?period=${e.target.value}`)}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p._count.invoices} invoice{p._count.invoices === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <form action={openAction} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="month">Open a month</label>
            <select id="month" name="month" className="field" defaultValue={defaults.month}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="label" htmlFor="year">Year</label>
            <input
              id="year"
              name="year"
              type="number"
              className="field num"
              defaultValue={defaults.year}
              min={2020}
              max={2100}
              aria-invalid={errors.year ? 'true' : undefined}
            />
          </div>
          <SubmitButton className="btn btn-quiet" pendingLabel="Opening…">
            Open
          </SubmitButton>
        </form>

        {selected && selected.status !== 'CLOSED' ? (
          <form action={genAction} className="ml-auto">
            <input type="hidden" name="periodId" value={selected.id} />
            <SubmitButton className="btn btn-primary" pendingLabel="Generating…">
              Generate invoices
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {openState.message ? (
        <Notice tone={openState.ok ? 'done' : 'error'}>{openState.message}</Notice>
      ) : null}
      {genState.message ? (
        <Notice tone={genState.ok ? 'done' : 'error'}>{genState.message}</Notice>
      ) : null}
    </div>
  );
}
