'use client';

import { useState } from 'react';

const HIDDEN = new Set(['passwordHash', 'id', 'createdAt', 'updatedAt']);

/** Money is stored in cents; showing raw integers here would mislead. */
const MONEY_KEYS = /balance|amount|rent|share|payable|discount|total|paid/i;

function present(value, key) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && MONEY_KEYS.test(key)) {
    return `KSh ${(value / 100).toLocaleString('en-KE')}`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Only the fields that actually changed. A full before/after dump of a row is
 * unreadable, and the question being asked of this screen is always "what
 * changed", not "what did the record look like".
 */
function changedFields(before, after) {
  if (!before) return Object.entries(after ?? {}).filter(([k]) => !HIDDEN.has(k));
  if (!after) return Object.entries(before).filter(([k]) => !HIDDEN.has(k));
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = [];
  for (const k of keys) {
    if (HIDDEN.has(k)) continue;
    const a = JSON.stringify(before[k]);
    const b = JSON.stringify(after[k]);
    if (a !== b) out.push([k, { from: before[k], to: after[k] }]);
  }
  return out;
}

export default function AuditDetail({ before, after }) {
  const [open, setOpen] = useState(false);
  const fields = changedFields(before, after);

  if (fields.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-quiet px-2 py-1 text-xs"
        onClick={() => setOpen(true)}
      >
        Detail
      </button>
    );
  }

  return (
    <div className="text-left">
      <button
        type="button"
        className="btn btn-quiet mb-1.5 px-2 py-1 text-xs"
        onClick={() => setOpen(false)}
      >
        Hide
      </button>
      <dl className="space-y-0.5 text-xs">
        {fields.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <dt className="min-w-32 text-ink-faint">{key}</dt>
            <dd className="num">
              {value && typeof value === 'object' && 'from' in value ? (
                <>
                  <span className="text-ink-faint line-through">{present(value.from, key)}</span>
                  {' → '}
                  <span>{present(value.to, key)}</span>
                </>
              ) : present(value, key)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
