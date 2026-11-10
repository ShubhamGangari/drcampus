import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTotalMarks,
  computeGradeForPercentage,
  computeGradeForMarks,
  buildHallTicketNo,
  computeResultTotals,
} from '../exam-core';

// ---- computeGradeForPercentage (spec §6.2 boundaries) ------------------------
test('grade: 89.9 -> A, 90 -> A+', () => {
  assert.strictEqual(computeGradeForPercentage(89.9), 'A');
  assert.strictEqual(computeGradeForPercentage(90), 'A+');
  assert.strictEqual(computeGradeForPercentage(99.99), 'A+');
});

test('grade: 39 -> F, 40 -> D', () => {
  assert.strictEqual(computeGradeForPercentage(39), 'F');
  assert.strictEqual(computeGradeForPercentage(39.99), 'F');
  assert.strictEqual(computeGradeForPercentage(40), 'D');
  assert.strictEqual(computeGradeForPercentage(49.99), 'D');
});

test('grade: remaining boundaries', () => {
  assert.strictEqual(computeGradeForPercentage(79.99), 'B+');
  assert.strictEqual(computeGradeForPercentage(80), 'A');
  assert.strictEqual(computeGradeForPercentage(69.99), 'B');
  assert.strictEqual(computeGradeForPercentage(70), 'B+');
  assert.strictEqual(computeGradeForPercentage(59.99), 'C');
  assert.strictEqual(computeGradeForPercentage(60), 'B');
  assert.strictEqual(computeGradeForPercentage(49.99), 'D');
  assert.strictEqual(computeGradeForPercentage(50), 'C');
});

// ---- computeTotalMarks (rounding) --------------------------------------------
test('total marks: sums and rounds to 2 decimals', () => {
  assert.strictEqual(computeTotalMarks(30, 60), 90);
  assert.strictEqual(computeTotalMarks(12.345, 23.456), 35.8);
  assert.strictEqual(computeTotalMarks(1.005, 0), 1.01);
  assert.strictEqual(computeTotalMarks(0, 0), 0);
});

test('total marks: grade derived from maxes (maxInternal 30 / maxExternal 70)', () => {
  assert.strictEqual(computeGradeForMarks(90, 30, 70), 'A+'); // 90%
  assert.strictEqual(computeGradeForMarks(89, 30, 70), 'A'); // 89%
  assert.strictEqual(computeGradeForMarks(39, 30, 70), 'F'); // 39%
});

// ---- buildHallTicketNo (spec §6.5 format) ------------------------------------
test('hall ticket number: HT-{YYYY}-{6-digit seq}', () => {
  assert.strictEqual(buildHallTicketNo(1, 2026), 'HT-2026-000001');
  assert.strictEqual(buildHallTicketNo(500, 2026), 'HT-2026-000500');
  assert.strictEqual(buildHallTicketNo(123456, 2026), 'HT-2026-123456');
  assert.strictEqual(buildHallTicketNo(0, 2026), 'HT-2026-000001'); // min seq 1
});

// ---- computeResultTotals ----------------------------------------------------
test('result totals: sums, max, percentage (2dp) and grade', () => {
  const r = computeResultTotals({ totalSecured: 180, totalMax: 200 });
  assert.strictEqual(r.totalSecured, 180);
  assert.strictEqual(r.totalMax, 200);
  assert.strictEqual(r.percentage, 90);
  assert.strictEqual(r.grade, 'A+');

  const r2 = computeResultTotals({ totalSecured: 1, totalMax: 3 });
  assert.strictEqual(r2.percentage, 33.33);
  assert.strictEqual(r2.grade, 'F');

  const r3 = computeResultTotals({ totalSecured: 0, totalMax: 0 });
  assert.strictEqual(r3.percentage, 0);
  assert.strictEqual(r3.grade, 'F');
});
