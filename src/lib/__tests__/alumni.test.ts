import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDonationTotals,
  isDonationMode,
  assertValidDonationAmount,
  DONATION_MODES,
} from '../alumni-core';

// ---- computeDonationTotals (spec §6.4: count = rows, sum = exact sum) --------
test('totals: empty list -> count 0, sum 0', () => {
  assert.deepEqual(computeDonationTotals([]), { count: 0, sum: 0 });
});

test('totals: single row -> count 1, exact sum', () => {
  assert.deepEqual(computeDonationTotals([{ amount: 250.5 }]), { count: 1, sum: 250.5 });
});

test('totals: multiple rows -> count = rows, sum = exact sum', () => {
  const rows = [
    { amount: 100 },
    { amount: 200.25 },
    { amount: 50.75 },
  ];
  assert.deepEqual(computeDonationTotals(rows), { count: 3, sum: 351 });
});

test('totals: float-safe cent rounding (no FP drift)', () => {
  const rows = [
    { amount: 0.1 },
    { amount: 0.2 },
    { amount: 0.3 },
  ];
  assert.deepEqual(computeDonationTotals(rows), { count: 3, sum: 0.6 });
});

test('totals: non-numeric / null amounts coerced to 0, still counted', () => {
  const rows = [
    { amount: Number.NaN },
    { amount: 10 },
    { amount: undefined as unknown as number },
  ];
  assert.deepEqual(computeDonationTotals(rows), { count: 3, sum: 10 });
});

// ---- isDonationMode / modes ------------------------------------------------
test('modes: accepts every documented mode', () => {
  for (const mode of DONATION_MODES) {
    assert.equal(isDonationMode(mode), true, mode);
  }
});

test('modes: rejects unknown/empty', () => {
  assert.equal(isDonationMode('BITCOIN'), false);
  assert.equal(isDonationMode(''), false);
  assert.equal(isDonationMode(undefined as unknown as string), false);
});

// ---- assertValidDonationAmount ----------------------------------------------
test('amount: positive finite accepted and rounded to cents', () => {
  assert.equal(assertValidDonationAmount(250.5), 250.5);
  assert.equal(assertValidDonationAmount(12.345), 12.35);
});

test('amount: zero / negative / non-finite rejected', () => {
  assert.throws(() => assertValidDonationAmount(0));
  assert.throws(() => assertValidDonationAmount(-5));
  assert.throws(() => assertValidDonationAmount(Number.NaN));
  assert.throws(() => assertValidDonationAmount(Infinity));
  assert.throws(() => assertValidDonationAmount('abc'));
});
