'use client';

import { useActionState, useState } from 'react';
import { removeCharge } from '@/actions/charges';
import SubmitButton from '@/components/SubmitButton';
import { fmt } from '@/lib/money';

const initial = { ok: null, message: null, errors: {} };

const TYPE_LABEL = {
  DAMAGE: 'Damage',
  KEY: 'Key or lock',
  CLEANING: 'Cleaning',
  OTHER: 'Other',
};

/**
 * The charges behind a month's total. Kept collapsed because most months have
 * none, but reachable, because "what is this 200 for?" is the question a
 * student asks at the counter.
 */
export default function ChargeList({ charges, total, canRemove }) {
  const [open, setOpen] = useState(false);

  if (charges.length === 0) return <span className="num">{fmt(total)}</span>;

  return (
    <div className="text-right">
      <button
        type="button"
        className="num underline decoration-dotted underline-offset-2 hover:text-enamel"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {fmt(total)}
      </button>
      {open ? (
        <ul className="mt-1 space-y-1 text-left text-xs">
          {charges.map((c) => (
            <ChargeRow key={c.id} charge={c} canRemove={canRemove} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ChargeRow({ charge, canRemove }) {
  const [state, action] = useActionState(removeCharge, initial);
  const isCredit = charge.amount < 0;

  return (
    <li className="border-t border-rule pt-1">
      <div className="flex items-baseline justify-between gap-2">
        <span>
          <span className="text-ink-faint">{TYPE_LABEL[charge.type] ?? charge.type}</span>
          {' — '}
          {charge.description}
        </span>
        <span className="num whitespace-nowrap">{fmt(charge.amount)}</span>
      </div>
      {canRemove && !isCredit ? (
        <form action={action} className="mt-0.5">
          <input type="hidden" name="chargeId" value={charge.id} />
          <SubmitButton className="btn btn-quiet px-1.5 py-0.5 text-[11px]" pendingLabel="…">
            Remove
          </SubmitButton>
        </form>
      ) : null}
      {state.message ? (
        <p className={state.ok ? 'hint' : 'err'}>{state.message}</p>
      ) : null}
    </li>
  );
}
