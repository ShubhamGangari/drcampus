import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePassRate,
  computeStudentFacultyRatio,
  aggregateNaac,
  aggregateNba,
  aggregateNirf,
} from '../report-core';

// ---- computePassRate (spec §6: pass = totalMarks >= 40) ---------------------

test('passRate: [40,39,50,60] -> 75', () => {
  const rows = [
    { totalMarks: 40 },
    { totalMarks: 39 },
    { totalMarks: 50 },
    { totalMarks: 60 },
  ];
  assert.equal(computePassRate(rows), 75);
});

test('passRate: boundary 40 passes, 39 fails', () => {
  // 1/3 pass; 1/3 * 100 = 33.3333... rounded to 2dp -> 33.33
  assert.equal(
    computePassRate([{ totalMarks: 40 }, { totalMarks: 39 }, { totalMarks: 39.99 }]),
    33.33
  );
});

test('passRate: empty rows -> null (omit, never 0)', () => {
  assert.equal(computePassRate([]), null);
});

test('passRate: all fail -> 0', () => {
  assert.equal(computePassRate([{ totalMarks: 10 }, { totalMarks: 39 }]), 0);
});

test('passRate: all pass -> 100', () => {
  assert.equal(computePassRate([{ totalMarks: 40 }, { totalMarks: 90 }]), 100);
});

test('passRate: rounds to 2 decimals', () => {
  // 2/3 = 66.666... -> 66.67
  assert.equal(computePassRate([{ totalMarks: 50 }, { totalMarks: 60 }, { totalMarks: 30 }]), 66.67);
});

// ---- computeStudentFacultyRatio ----------------------------------------------

test('ratio: students / faculty rounded to 2dp', () => {
  assert.equal(computeStudentFacultyRatio(128, 42), 3.05);
  assert.equal(computeStudentFacultyRatio(100, 4), 25);
  assert.equal(computeStudentFacultyRatio(1, 3), 0.33);
});

test('ratio: faculty 0 -> null (omit)', () => {
  assert.equal(computeStudentFacultyRatio(100, 0), null);
});

test('ratio: non-finite input -> null', () => {
  assert.equal(computeStudentFacultyRatio(Number.NaN, 5), null);
  assert.equal(computeStudentFacultyRatio(100, Number.POSITIVE_INFINITY), null);
});

// ---- aggregateNaac -----------------------------------------------------------

test('naac: includes counts + ratio; omits passRate when null', () => {
  const m = aggregateNaac({
    totalStudents: 128,
    totalFaculty: 42,
    programs: 6,
    courses: 80,
    passRate: null,
  });
  assert.deepEqual(
    m.map((x) => x.key),
    ['totalStudents', 'totalFaculty', 'programs', 'courses', 'studentFacultyRatio']
  );
  assert.equal(m.find((x) => x.key === 'studentFacultyRatio')!.value, 3.05);
  assert.equal(m.find((x) => x.key === 'totalStudents')!.label, 'Total Students');
});

test('naac: includes passRate when provided', () => {
  const m = aggregateNaac({ totalStudents: 10, totalFaculty: 2, passRate: 87.5 });
  const pr = m.find((x) => x.key === 'passRate');
  assert.ok(pr);
  assert.equal(pr!.label, 'Overall Pass Rate (%)');
  assert.equal(pr!.value, 87.5);
});

test('naac: omits ratio when faculty is 0', () => {
  const m = aggregateNaac({ totalStudents: 10, totalFaculty: 0 });
  assert.ok(!m.some((x) => x.key === 'studentFacultyRatio'));
});

// ---- aggregateNba -----------------------------------------------------------

test('nba: omits poAttainmentAvg when no OBE data', () => {
  const m = aggregateNba({ studentsInProgram: 45, courses: 12, passRate: 88.8, poAttainmentAvg: null });
  assert.deepEqual(
    m.map((x) => x.key),
    ['studentsInProgram', 'courses', 'passRate']
  );
});

test('nba: includes poAttainmentAvg when present', () => {
  const m = aggregateNba({ studentsInProgram: 45, courses: 12, poAttainmentAvg: 73.33 });
  const p = m.find((x) => x.key === 'poAttainmentAvg');
  assert.ok(p);
  assert.equal(p!.label, 'Avg PO Attainment (%)');
  assert.equal(p!.value, 73.33);
});

test('nba: omits passRate when no published marks', () => {
  const m = aggregateNba({ studentsInProgram: 45, courses: 12, passRate: null });
  assert.ok(!m.some((x) => x.key === 'passRate'));
});

// ---- aggregateNirf -----------------------------------------------------------

test('nirf: full shape when all data present', () => {
  const m = aggregateNirf({
    studentStrength: 100,
    studentFacultyRatio: 4.17,
    graduationOutput: 80,
    programs: 3,
  });
  assert.deepEqual(
    m.map((x) => x.key),
    ['studentStrength', 'studentFacultyRatio', 'graduationOutput', 'programs']
  );
  assert.equal(m.find((x) => x.key === 'studentStrength')!.label, 'Student Strength');
});

test('nirf: omits ratio/output when null (no source data)', () => {
  const m = aggregateNirf({
    studentStrength: 100,
    studentFacultyRatio: null,
    graduationOutput: null,
    programs: 3,
  });
  assert.deepEqual(
    m.map((x) => x.key),
    ['studentStrength', 'programs']
  );
});
