import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAttendancePercentage,
  computeTeacherSummary,
  formatDDMon,
  computeAbsentDatesByStudent,
  buildRegisterMatrix,
  computeWeeklyStats,
  buildAnalyticsTeachers,
  parseOptionalDate,
} from '../attendance-core';
import { ApiError } from '../errors';

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

// ---- formatDDMon (DD Mon) ---------------------------------------------------
test('formatDDMon: YYYY-MM-DD -> DD Mon', () => {
  assert.strictEqual(formatDDMon('2026-03-12'), '12 Mar');
  assert.strictEqual(formatDDMon('2026-01-01'), '1 Jan');
  assert.strictEqual(formatDDMon('2026-12-31'), '31 Dec');
  assert.strictEqual(formatDDMon('not-a-date'), 'not-a-date');
});

// ---- computeAbsentDatesByStudent ------------------------------------------
test('absent dates: groups ABSENT per student, ascending DD Mon', () => {
  const map = computeAbsentDatesByStudent([
    { studentId: 's1', status: 'ABSENT', date: '2026-03-14' },
    { studentId: 's1', status: 'PRESENT', date: '2026-03-15' },
    { studentId: 's1', status: 'ABSENT', date: '2026-03-12' },
    { studentId: 's2', status: 'ABSENT', date: '2026-03-20' },
  ]);
  assert.deepEqual(map.get('s1'), ['12 Mar', '14 Mar']);
  assert.deepEqual(map.get('s2'), ['20 Mar']);
});

test('absent dates: PRESENT only -> no dates', () => {
  const map = computeAbsentDatesByStudent([
    { studentId: 's1', status: 'PRESENT', date: '2026-03-12' },
  ]);
  assert.deepEqual(map.get('s1'), undefined);
});

// ---- buildRegisterMatrix ---------------------------------------------------
const regStudents = {
  s1: { rollNo: 'R2', name: 'B Student' },
  s2: { rollNo: 'R1', name: 'A Student' },
};

test('register: header is ascending dates with >=1 record', () => {
  const { header } = buildRegisterMatrix(
    [
      { studentId: 's1', status: 'PRESENT', date: '2026-03-03' },
      { studentId: 's2', status: 'ABSENT', date: '2026-03-01' },
      { studentId: 's1', status: 'ABSENT', date: '2026-03-01' },
    ],
    regStudents
  );
  assert.deepEqual(header, ['1 Mar', '3 Mar']);
});

test('register: cells align to header; null when no record that day', () => {
  const { rows } = buildRegisterMatrix(
    [
      { studentId: 's1', status: 'PRESENT', date: '2026-03-03' },
      { studentId: 's1', status: 'ABSENT', date: '2026-03-01' },
      { studentId: 's2', status: 'ABSENT', date: '2026-03-01' },
    ],
    regStudents
  );
  const byId = Object.fromEntries(rows.map((r) => [r.studentId, r]));
  assert.deepEqual(byId.s1.cells, ['A', 'P']);
  assert.deepEqual(byId.s2.cells, ['A', null]);
  assert.strictEqual(byId.s1.present, 1);
  assert.strictEqual(byId.s1.total, 2);
  assert.strictEqual(byId.s1.percentage, 50);
  assert.deepEqual(byId.s1.absentDates, ['1 Mar']);
  assert.strictEqual(byId.s2.present, 0);
  assert.strictEqual(byId.s2.percentage, 0);
});

test('register: rows sorted by rollNo', () => {
  const { rows } = buildRegisterMatrix(
    [
      { studentId: 's1', status: 'PRESENT', date: '2026-03-01' },
      { studentId: 's2', status: 'ABSENT', date: '2026-03-01' },
    ],
    regStudents
  );
  assert.strictEqual(rows[0].studentId, 's2'); // R1 < R2
  assert.strictEqual(rows[1].studentId, 's1');
});

// ---- computeWeeklyStats ----------------------------------------------------
test('weekly stats: groups by ISO week, sums present/absent, ordered', () => {
  const stats = computeWeeklyStats([
    { date: '2026-03-16', status: 'PRESENT' }, // Mon, week 12
    { date: '2026-03-17', status: 'ABSENT' },  // Tue, week 12
    { date: '2026-03-18', status: 'PRESENT' }, // Wed, week 12
    { date: '2026-03-09', status: 'PRESENT' }, // Mon, week 11
  ]);
  assert.strictEqual(stats[0].weekLabel, 'Wk 11');
  assert.strictEqual(stats[0].present, 1);
  assert.strictEqual(stats[0].absent, 0);
  assert.strictEqual(stats[1].weekLabel, 'Wk 12');
  assert.strictEqual(stats[1].present, 2);
  assert.strictEqual(stats[1].absent, 1);
});

// ---- buildAnalyticsTeachers ------------------------------------------------
test('analytics teachers: markedCount distinct dates, dates ascending DD Mon', () => {
  const teachers = buildAnalyticsTeachers(
    [
      { date: '2026-03-14', markedById: 't1' },
      { date: '2026-03-01', markedById: 't1' },
      { date: '2026-03-14', markedById: 't1' },
      { date: '2026-03-02', markedById: 't2' },
    ],
    { t1: 'Arun Sir', t2: 'Priya Mam' }
  );
  const byId = Object.fromEntries(teachers.map((t) => [t.teacherId, t]));
  assert.strictEqual(byId.t1.markedCount, 2);
  assert.deepEqual(byId.t1.dates, ['1 Mar', '14 Mar']);
  assert.strictEqual(byId.t2.markedCount, 1);
  assert.deepEqual(byId.t2.dates, ['2 Mar']);
});

// ---- parseOptionalDate (window bound parsing for report/defaulter/analytics) -
test('parseOptionalDate: null/empty -> undefined (no bound)', () => {
  assert.strictEqual(parseOptionalDate(null, 'from', false), undefined);
  assert.strictEqual(parseOptionalDate('', 'to', true), undefined);
});

test('parseOptionalDate: valid YYYY-MM-DD, gte midnight / lte end-of-day', () => {
  const from = parseOptionalDate('2026-09-01', 'from', false)!;
  const to = parseOptionalDate('2026-09-30', 'to', true)!;
  assert.strictEqual(from.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.strictEqual(to.toISOString(), '2026-09-30T23:59:59.999Z');
});

test('parseOptionalDate: invalid format throws 400 VALIDATION_ERROR', () => {
  assert.throws(
    () => parseOptionalDate('2026/09/01', 'from', false),
    (e: unknown) => e instanceof ApiError && e.statusCode === 400 && e.code === 'VALIDATION_ERROR'
  );
});

test('parseOptionalDate: non-YYYY-MM-DD string throws 400 VALIDATION_ERROR', () => {
  assert.throws(
    () => parseOptionalDate('last-month', 'from', false),
    (e: unknown) => e instanceof ApiError && e.statusCode === 400 && e.code === 'VALIDATION_ERROR'
  );
});
