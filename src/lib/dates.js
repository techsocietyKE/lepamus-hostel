/**
 * Billing months are decided in Nairobi time, never UTC.
 * A payment at 01:00 on 1 August in Nairobi is 22:00 on 31 July in UTC, and
 * would be filed against the wrong month if we let the server's clock decide.
 */
const TZ = 'Africa/Nairobi';

const partsOf = (date) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [{ value: y }, , { value: m }, , { value: d }] = fmt.formatToParts(date);
  return { year: Number(y), month: Number(m), day: Number(d) };
};

/** Today's calendar date in Nairobi, as {year, month, day}. */
export const nairobiToday = (date = new Date()) => partsOf(date);

/** "2026-07-31" for a Date, in Nairobi terms. */
export function isoDate(date = new Date()) {
  const { year, month, day } = partsOf(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A Date fixed at midnight UTC for a calendar day — what @db.Date columns want. */
export function dateOnly(input) {
  if (!input) return null;
  const s = typeof input === 'string' ? input.slice(0, 10) : isoDate(input);
  return new Date(`${s}T00:00:00.000Z`);
}

export function monthLabel(year, month) {
  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Rotation seed for the rent rounding, so the extra shilling moves each month. */
export const rotationFor = (year, month) => year * 12 + month;

export function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}
