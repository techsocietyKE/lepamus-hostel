/**
 * CSV that Excel opens without complaint.
 *
 * Two details matter and are easy to miss: a field starting with =, +, - or @
 * is treated as a formula by spreadsheet software, so it is prefixed; and Excel
 * needs a UTF-8 byte-order mark or it renders shilling amounts and names with
 * accents as mojibake.
 */

const RISKY_START = /^[=+\-@\t\r]/;

function cell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (RISKY_START.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n');
}

/** Money for a spreadsheet: plain shillings, no separators, so it sums. */
export function csvMoney(cents) {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

export function csvResponse(rows, filename) {
  const body = '﻿' + toCsv(rows);
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
