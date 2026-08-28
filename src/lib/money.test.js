/**
 * Checks the billing rules against the worked examples in Appendix A of the
 * specification. Run with: npm run test:money
 */
import assert from 'node:assert/strict';
import { toCents, fmt, splitRent, priceRange } from './money.js';

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\nParsing and formatting');
check('parses plain numbers', () => assert.equal(toCents('2500'), 250000));
check('parses thousands separators', () => assert.equal(toCents('2,500'), 250000));
check('parses decimals', () => assert.equal(toCents('1333.33'), 133333));
check('strips currency text', () => assert.equal(toCents('KSh 4,000'), 400000));
check('rejects rubbish', () => assert.equal(toCents('abc'), null));
check('formats whole shillings', () => assert.equal(fmt(250000), '2,500'));
check('formats with cents only when present', () => assert.equal(fmt(133333), '1,333.33'));
check('formats a credit', () => assert.equal(fmt(-50000), '-500'));

console.log('\nRule 1 — room price divides by ACTUAL occupants');
check('A1 at 2,500 with one occupant: pays all of it', () =>
  assert.deepEqual(splitRent(250000, 1), [250000]));
check('A1 at 2,500 with two occupants: 1,250 each', () =>
  assert.deepEqual(splitRent(250000, 2), [125000, 125000]));
check('C5 at 3,000 with two occupants: 1,500 each', () =>
  assert.deepEqual(splitRent(300000, 2), [150000, 150000]));
check('C5 at 3,000 with three occupants: 1,000 each', () =>
  assert.deepEqual(splitRent(300000, 3), [100000, 100000, 100000]));
check('4,000 room with one occupant', () =>
  assert.deepEqual(splitRent(400000, 1), [400000]));
check('4,000 room with two occupants', () =>
  assert.deepEqual(splitRent(400000, 2), [200000, 200000]));

console.log('\nRule — uneven division rounds to the shilling and always sums exactly');
check('4,000 / 3 = 1,334 + 1,333 + 1,333', () =>
  assert.deepEqual(splitRent(400000, 3), [133400, 133300, 133300]));
check('the shares sum to the room rent exactly', () => {
  const shares = splitRent(400000, 3);
  assert.equal(shares.reduce((a, b) => a + b, 0), 400000);
});
check('every capacity from 1 to 6 sums exactly, for many prices', () => {
  for (let rent = 100000; rent <= 900000; rent += 12345) {
    for (let n = 1; n <= 6; n += 1) {
      for (let rot = 0; rot < 6; rot += 1) {
        const shares = splitRent(Math.round(rent / 100) * 100, n, rot);
        const total = shares.reduce((a, b) => a + b, 0);
        assert.equal(total, Math.round(rent / 100) * 100,
          `rent ${rent} n ${n} rot ${rot} summed to ${total}`);
      }
    }
  }
});

console.log('\nRule — the extra shilling rotates, so nobody carries it every month');
check('rotation moves which occupant pays the extra shilling', () => {
  const july = splitRent(400000, 3, 7);
  const august = splitRent(400000, 3, 8);
  const september = splitRent(400000, 3, 9);
  assert.equal(july.indexOf(133400), 1);
  assert.equal(august.indexOf(133400), 2);
  assert.equal(september.indexOf(133400), 0);
});
check('rotation never changes the total', () => {
  for (let rot = 0; rot < 24; rot += 1) {
    assert.equal(splitRent(400000, 3, rot).reduce((a, b) => a + b, 0), 400000);
  }
});

console.log('\nEdge cases');
check('zero occupants returns nothing to bill', () =>
  assert.deepEqual(splitRent(300000, 0), []));
check('negative occupants returns nothing', () =>
  assert.deepEqual(splitRent(300000, -2), []));
check('a free room splits to zeroes', () =>
  assert.deepEqual(splitRent(0, 3), [0, 0, 0]));

console.log('\nPublic price display');
check('a 3-sharing room at 3,000 with one occupant shows both figures', () => {
  const p = priceRange(300000, 1, 3);
  assert.equal(p.ifYouJoinNow, 150000);
  assert.equal(p.whenFull, 100000);
});
check('an empty room shows the full rent as the join-now price', () => {
  const p = priceRange(300000, 0, 3);
  assert.equal(p.ifYouJoinNow, 300000);
  assert.equal(p.whenFull, 100000);
});

console.log(`\n${passed} checks passed.\n`);
