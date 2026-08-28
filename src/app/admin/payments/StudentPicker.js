'use client';

import { useMemo, useState } from 'react';
import { fmt } from '@/lib/money';

/**
 * Choosing one student out of a hundred and fifty.
 *
 * A plain dropdown is unusable at that length, and a typeahead that hides its
 * options behind a popup is worse for staff who are not sure what they are
 * allowed to type. So: an ordinary search box over a visible list. Nothing is
 * hidden, the list is always on screen, and scrolling still works for anyone
 * who would rather not type at all.
 */
export default function StudentPicker({ students, error }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    // Digits typed with or without spaces should both find a phone number.
    const digits = q.replace(/\s/g, '');
    return students.filter((s) => s.haystack.includes(q) || s.haystack.includes(digits));
  }, [students, query]);

  const chosen = students.find((s) => s.id === selected);

  return (
    <div>
      <label className="label" htmlFor="studentSearch">Student</label>
      <input
        id="studentSearch"
        type="search"
        className="field"
        placeholder="Search by name, room or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      <select
        name="studentId"
        className="field mt-2"
        size={6}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        required
        aria-label="Matching students"
        aria-invalid={error ? 'true' : undefined}
      >
        {matches.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.roomCode ? ` — ${s.roomCode}` : ' — no room'}
            {s.balance > 0 ? ` — owes ${fmt(s.balance)}` : ''}
            {s.balance < 0 ? ` — ${fmt(-s.balance)} in credit` : ''}
          </option>
        ))}
      </select>

      {error ? <p className="err">{error}</p> : (
        <p className="hint">
          {query.trim() === ''
            ? `${students.length} student${students.length === 1 ? '' : 's'}. Type to narrow the list, then click a name.`
            : matches.length === 0
              ? 'Nobody matches that. Check the spelling, or clear the search.'
              : `${matches.length} of ${students.length} shown. Click a name to choose it.`}
        </p>
      )}

      {chosen ? (
        <p className="mt-1 text-sm">
          Recording for <span className="font-medium">{chosen.name}</span>
          {chosen.roomCode ? `, room ${chosen.roomCode}` : ''}
          {chosen.balance > 0 ? ` — owes KSh ${fmt(chosen.balance)}` : ''}
          {chosen.balance < 0 ? ` — KSh ${fmt(-chosen.balance)} in credit` : ''}
          .
        </p>
      ) : null}
    </div>
  );
}
