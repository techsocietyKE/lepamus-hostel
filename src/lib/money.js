/**
 * Money is ALWAYS integer cents. Never a float, never a string, in the database
 * or in any calculation. Floating point on money produces balances that are off
 * by a shilling and cannot be explained to a student.
 */

/** Parse user input ("2500", "2,500", "2500.50", "KSh 2,500") into cents. */
export function toCents(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number') return Math.round(input * 100);
  const cleaned = String(input).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Format cents for display: 250000 -> "2,500". Shows decimals only when present. */
export function fmt(cents, { withSymbol = false } = {}) {
  if (cents === null || cents === undefined) return '—';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const shillings = Math.floor(abs / 100);
  const remainder = abs % 100;
  let out = shillings.toLocaleString('en-KE');
  if (remainder !== 0) out += '.' + String(remainder).padStart(2, '0');
  if (negative) out = '-' + out;
  return withSymbol ? `KSh ${out}` : out;
}

/** Format with the symbol always. */
export function ksh(cents) {
  return fmt(cents, { withSymbol: true });
}

/**
 * Divide a room's monthly rent equally among its actual occupants.
 *
 * The room price divides by how many people are ACTUALLY in the room, not by
 * its capacity. One student in a KSh 4,000 room pays the whole 4,000.
 *
 * Shares are rounded to whole shillings and always sum to exactly the room
 * rent. Where the division is uneven the extra shilling(s) go to one occupant,
 * and `rotation` moves which one, so the same student does not carry it every
 * month. Pass the month number as rotation.
 *
 * 400000 cents / 3 -> [133400, 133300, 133300]  (1,334 + 1,333 + 1,333 = 4,000)
 *
 * @param {number} roomRentCents whole room price in cents
 * @param {number} occupants     number of people actually living there
 * @param {number} rotation      any integer; same value gives the same split
 * @returns {number[]} one share in cents per occupant, summing to roomRentCents
 */
export function splitRent(roomRentCents, occupants, rotation = 0) {
  if (!Number.isInteger(roomRentCents)) throw new Error('roomRentCents must be integer cents');
  if (!Number.isInteger(occupants) || occupants < 1) return [];

  const totalShillings = Math.round(roomRentCents / 100);
  const base = Math.floor(totalShillings / occupants);
  const remainder = totalShillings - base * occupants;

  const shares = new Array(occupants).fill(base);
  const offset = ((rotation % occupants) + occupants) % occupants;
  for (let i = 0; i < remainder; i += 1) {
    shares[(offset + i) % occupants] += 1;
  }
  return shares.map((s) => s * 100);
}

/** The share one specific occupant pays, by their position in the room. */
export function shareForOccupant(roomRentCents, occupants, index, rotation = 0) {
  const shares = splitRent(roomRentCents, occupants, rotation);
  return shares[index] ?? 0;
}

/**
 * Price shown on the public availability page.
 * Two figures, because a student joining a half-empty room is otherwise
 * surprised when the room fills up and their share changes.
 */
export function priceRange(roomRentCents, currentOccupants, capacity) {
  const now = currentOccupants > 0
    ? splitRent(roomRentCents, currentOccupants + 1, 0)[0]
    : roomRentCents;
  const whenFull = splitRent(roomRentCents, capacity, 0)[0];
  return { ifYouJoinNow: now, whenFull };
}

/** Split an amount across occupants for a shared charge (damage, cleaning). */
export function splitCharge(amountCents, people, rotation = 0) {
  return splitRent(amountCents, people, rotation);
}
