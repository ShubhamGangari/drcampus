import test from 'node:test';
import assert from 'node:assert/strict';
import { computePOAttainment } from '../obe-core';

// ---- computePOAttainment (spec §6.3 + AC#5) ---------------------------------

test('PO attainment: AC#5 weighted average -> 73.33', () => {
  const weights = [
    { coId: 'co_a', weight: 1.0 },
    { coId: 'co_b', weight: 0.5 },
  ];
  const attainments = [
    { coId: 'co_a', attainment: 80 },
    { coId: 'co_b', attainment: 60 },
  ];
  // (80×1 + 60×0.5) / (1 + 0.5) = 110 / 1.5 = 73.333... -> 73.33
  assert.strictEqual(computePOAttainment(weights, attainments), 73.33);
});

test('PO attainment: empty inputs -> 0', () => {
  assert.strictEqual(computePOAttainment([], []), 0);
});

test('PO attainment: no matching attainments -> 0', () => {
  const weights = [{ coId: 'co_a', weight: 1.0 }];
  assert.strictEqual(computePOAttainment(weights, []), 0);
  assert.strictEqual(computePOAttainment(weights, [{ coId: 'co_other', attainment: 90 }]), 0);
});

test('PO attainment: single CO -> that attainment (weight cancels)', () => {
  const weights = [{ coId: 'co_a', weight: 0.8 }];
  const attainments = [{ coId: 'co_a', attainment: 65 }];
  assert.strictEqual(computePOAttainment(weights, attainments), 65);
});

test('PO attainment: multiple COs with equal weights -> mean', () => {
  const weights = [
    { coId: 'co_a', weight: 1 },
    { coId: 'co_b', weight: 1 },
    { coId: 'co_c', weight: 1 },
  ];
  const attainments = [
    { coId: 'co_a', attainment: 40 },
    { coId: 'co_b', attainment: 50 },
    { coId: 'co_c', attainment: 60 },
  ];
  assert.strictEqual(computePOAttainment(weights, attainments), 50);
});

test('PO attainment: ignores mappings without attainment, keeps others', () => {
  const weights = [
    { coId: 'co_a', weight: 1 },
    { coId: 'co_b', weight: 1 }, // no attainment -> ignored
  ];
  const attainments = [{ coId: 'co_a', attainment: 70 }];
  assert.strictEqual(computePOAttainment(weights, attainments), 70);
});

test('PO attainment: rounding to 2 decimals', () => {
  const weights = [{ coId: 'co_a', weight: 3 }];
  const attainments = [{ coId: 'co_a', attainment: 33.333 }];
  assert.strictEqual(computePOAttainment(weights, attainments), 33.33);
});

test('PO attainment: zero total weight -> 0 (not NaN)', () => {
  const weights = [{ coId: 'co_a', weight: 0 }];
  const attainments = [{ coId: 'co_a', attainment: 80 }];
  assert.strictEqual(computePOAttainment(weights, attainments), 0);
});
