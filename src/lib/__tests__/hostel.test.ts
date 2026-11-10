import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occupiedCount, computeCapacityState, roundMoney2, tenantFilter } from '../hostel-core';

const active = () => ({ vacatedAt: null });
const vacated = () => ({ vacatedAt: new Date('2026-01-01T00:00:00Z') });

// ---- occupiedCount -----------------------------------------------------------

test('occupiedCount: empty list -> 0', () => {
  assert.equal(occupiedCount([]), 0);
});

test('occupiedCount: all active -> full count', () => {
  assert.equal(occupiedCount([active(), active(), active()]), 3);
});

test('occupiedCount: counts only non-vacated allocations', () => {
  assert.equal(occupiedCount([active(), vacated(), active(), vacated()]), 2);
  assert.equal(occupiedCount([vacated(), vacated()]), 0);
});

test('occupiedCount: mixed with null/undefined-safe values', () => {
  const list = [active(), { vacatedAt: null }, vacated()];
  assert.equal(occupiedCount(list), 2);
});

// ---- computeCapacityState ----------------------------------------------------

test('computeCapacityState: empty room has full availability', () => {
  const s = computeCapacityState(0, 4);
  assert.deepEqual(s, { occupied: 0, capacity: 4, available: 4, isFull: false });
});

test('computeCapacityState: partial occupancy not full', () => {
  const s = computeCapacityState(3, 4);
  assert.deepEqual(s, { occupied: 3, capacity: 4, available: 1, isFull: false });
});

test('computeCapacityState: occupied == capacity is full', () => {
  const s = computeCapacityState(4, 4);
  assert.deepEqual(s, { occupied: 4, capacity: 4, available: 0, isFull: true });
});

test('computeCapacityState: over-capacity is full and never negative available', () => {
  const s = computeCapacityState(6, 4);
  assert.deepEqual(s, { occupied: 6, capacity: 4, available: 0, isFull: true });
});

test('computeCapacityState: coerces negatives/float to non-negative integers', () => {
  const s = computeCapacityState(-2, 3.9);
  assert.deepEqual(s, { occupied: 0, capacity: 3, available: 3, isFull: false });
});

test('computeCapacityState: isFull drives the ROOM_FULL business rule', () => {
  const full = computeCapacityState(2, 2);
  assert.equal(full.isFull, true);
  const notFull = computeCapacityState(1, 2);
  assert.equal(notFull.isFull, false);
});

// ---- roundMoney2 -------------------------------------------------------------

test('roundMoney2: rounds to cent precision', () => {
  assert.equal(roundMoney2(1234.567), 1234.57);
  assert.equal(roundMoney2(10), 10);
  assert.equal(roundMoney2(0.1 + 0.2), 0.3);
  assert.equal(roundMoney2(9.999), 10);
});

// ---- tenantFilter ------------------------------------------------------------

test('tenantFilter: school-scoped user gets no explicit schoolId', () => {
  assert.deepEqual(tenantFilter(false, 'sch_eng'), {});
});

test('tenantFilter: central user without schoolId gets empty filter', () => {
  assert.deepEqual(tenantFilter(true, undefined), {});
});

test('tenantFilter: central user with schoolId scopes to it', () => {
  assert.deepEqual(tenantFilter(true, 'sch_med'), { schoolId: 'sch_med' });
});
