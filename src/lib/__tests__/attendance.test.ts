import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAttendancePercentage, computeTeacherSummary } from '../attendance-core';

// ---- computeAttendancePercentage (spec §6.1) ---------------------------------
test('attendance %: 0/0 -> null (row omitted)', () => {
  assert.strictEqual(computeAttendancePercentage(0, 0), null);
});

test('attendance %: 3/4 -> 75', () => {
  assert.strictEqual(computeAttendancePercentage(3, 4), 75);
});

test('attendance %: 1/3 -> 33.33', () => {
  assert.strictEqual(computeAttendancePercentage(1, 3), 33.33);
});

test('attendance %: 10/10 -> 100', () => {
  assert.strictEqual(computeAttendancePercentage(10, 10), 100);
});

test('attendance %: 0/5 -> 0', () => {
  assert.strictEqual(computeAttendancePercentage(0, 5), 0);
});

// ---- computeTeacherSummary (drill-down per-teacher marked dates) --------------
test('teacher summary: groups dates per teacher, newest first', () => {
  const summary = computeTeacherSummary(
    [
      { date: '2026-09-01', markedById: 't1' },
      { date: '2026-09-02', markedById: 't1' },
      { date: '2026-09-01', markedById: 't2' },
      { date: '2026-09-03', markedById: 't1' },
    ],
    { t1: 'Arun Sir', t2: 'Priya Mam' }
  );
  const byId = Object.fromEntries(summary.map((s) => [s.teacherId, s]));
  assert.strictEqual(summary.length, 2);
  assert.strictEqual(byId.t1.markedCount, 3);
  assert.deepEqual(byId.t1.dates, ['2026-09-03', '2026-09-02', '2026-09-01']);
  assert.strictEqual(byId.t2.markedCount, 1);
  assert.deepEqual(byId.t2.dates, ['2026-09-01']);
});

test('teacher summary: ignores records without mootById', () => {
  const summary = computeTeacherSummary(
    [
      { date: '2026-09-01', markedById: null },
      { date: '2026-09-02', markedById: 't1' },
    ],
    { t1: 'Arun Sir' }
  );
  assert.strictEqual(summary.length, 1);
  assert.strictEqual(summary[0].teacherId, 't1');
});

test('teacher summary: duplicates on same date counted once', () => {
  const summary = computeTeacherSummary(
    [
      { date: '2026-09-01', markedById: 't1' },
      { date: '2026-09-01', markedById: 't1' },
    ],
    { t1: 'Arun Sir' }
  );
  assert.strictEqual(summary[0].markedCount, 1);
  assert.deepEqual(summary[0].dates, ['2026-09-01']);
});
