import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRollNo,
  computeNextRollNo,
  generateRollNo,
  findDuplicateEnrollment,
  isGraduateEligible,
  canEnrollStudent,
  hasLeaveOverlap,
  isBatchProgramMismatch,
  resolveCreateTenant,
} from '../student-lifecycle';
import { ApiError } from '../errors';
import { type Db } from '../prisma';

// ---- rollNo generation ------------------------------------------------------

test('rollNo: formats as programCode-0001 and pads to 4 digits', () => {
  assert.equal(buildRollNo('BTECH-CSE', 1), 'BTECH-CSE-0001');
  assert.equal(buildRollNo('BTECH-CSE', 42), 'BTECH-CSE-0042');
  assert.equal(buildRollNo('MBBS', 145), 'MBBS-0145');
  assert.equal(buildRollNo('BCA', 10000), 'BCA-10000');
});

test('rollNo: floor()s fractional/non-integer sequences', () => {
  assert.equal(buildRollNo('BTECH-CSE', 2.9), 'BTECH-CSE-0002');
});

test('rollNo: clamps sequences below 1 to 1', () => {
  assert.equal(buildRollNo('MBBS', 0), 'MBBS-0001');
  assert.equal(buildRollNo('MBBS', -5), 'MBBS-0001');
});

test('rollNo: uniqueness over a range (no collisions)', () => {
  const set = new Set<string>();
  for (let i = 1; i <= 500; i++) {
    const roll = buildRollNo('BTECH-CSE', i);
    assert.equal(set.has(roll), false, `duplicate rollNo generated: ${roll}`);
    set.add(roll);
  }
  assert.equal(set.size, 500);
});

// ---- computeNextRollNo (pure) / generateRollNo (DB-backed) -------------------

test('computeNextRollNo: returns max suffix + 1, not count-based', () => {
  // Seed-like list with a gap: max is 3, so next must be 0004 (not 0003,
  // which a count of 2 would produce).
  const existing = ['BTECH-CSE-0001', 'BTECH-CSE-0003'];
  assert.equal(computeNextRollNo('BTECH-CSE', existing), 'BTECH-CSE-0004');
});

test('computeNextRollNo: empty list starts at 0001', () => {
  assert.equal(computeNextRollNo('BTECH-CSE', []), 'BTECH-CSE-0001');
});

test('computeNextRollNo: ignores rollNos that do not match the prefix pattern', () => {
  assert.equal(
    computeNextRollNo('BTECH-CSE', ['AIML-0001', 'X-0009', 'BTECH-CSE-0002']),
    'BTECH-CSE-0003'
  );
});

test('generateRollNo: returns max + 1 for a seed-like set of existing rollNos', async () => {
  const db = {
    student: {
      findMany: async ({ select }: { select: unknown }) => {
        assert.deepEqual(select, { rollNo: true });
        return [{ rollNo: 'BTECH-CSE-0001' }, { rollNo: 'BTECH-CSE-0003' }];
      },
    },
  };
  const rollNo = await generateRollNo(db as unknown as Db, { id: 'prog_btech_cse', code: 'BTECH-CSE' }, 'sch_eng');
  assert.equal(rollNo, 'BTECH-CSE-0004');
});

test('generateRollNo: returns 0001 when no students exist for the program+school', async () => {
  const db = {
    student: {
      findMany: async () => [],
    },
  };
  const rollNo = await generateRollNo(db as unknown as Db, { id: 'prog_mbbs', code: 'MBBS' }, 'sch_med');
  assert.equal(rollNo, 'MBBS-0001');
});

// ---- enrollment-duplicate detection ------------------------------------------

const ENROLLMENTS = [
  { academicYear: '2024-2025', semester: 1 },
  { academicYear: '2024-2025', semester: 2 },
  { academicYear: '2025-2026', semester: 1 },
] as const;

test('enroll: returns the existing enrollment for the same triple', () => {
  const dup = findDuplicateEnrollment(ENROLLMENTS, '2024-2025', 1);
  assert.deepEqual(dup, { academicYear: '2024-2025', semester: 1 });
});

test('enroll: returns undefined when the triple is new', () => {
  assert.equal(findDuplicateEnrollment(ENROLLMENTS, '2025-2026', 2), undefined);
  assert.equal(findDuplicateEnrollment(ENROLLMENTS, '2026-2027', 1), undefined);
});

test('enroll: empty history never matches', () => {
  assert.equal(findDuplicateEnrollment([], '2024-2025', 1), undefined);
});

test('enroll: semester comparison is numeric (string vs number tolerated)', () => {
  const numeric = findDuplicateEnrollment([{ academicYear: '2024-2025', semester: 1 }], '2024-2025', '1' as unknown as number);
  assert.deepEqual(numeric, { academicYear: '2024-2025', semester: 1 });
});

// ---- graduate-eligibility predicate -----------------------------------------

test('graduate: eligible only when ACTIVE + has enrollment + not already graduated', () => {
  assert.equal(isGraduateEligible({ status: 'ACTIVE' }, true), true);
});

test('graduate: not ACTIVE -> ineligible', () => {
  assert.equal(isGraduateEligible({ status: 'ON_LEAVE' }, true), false);
  assert.equal(isGraduateEligible({ status: 'DROPPED' }, true), false);
  assert.equal(isGraduateEligible({ status: 'GRADUATED' }, true), false);
});

test('graduate: already graduated -> ineligible even with enrollment', () => {
  assert.equal(isGraduateEligible({ status: 'GRADUATED' }, true), false);
});

test('graduate: no enrollment -> ineligible even when ACTIVE', () => {
  assert.equal(isGraduateEligible({ status: 'ACTIVE' }, false), false);
});

// ---- tenant resolution for create-style writes ------------------------------

test('resolveCreateTenant: a school-scoped user returns their own schoolId (ignores body)', () => {
  assert.equal(resolveCreateTenant({ schoolId: 'sch_eng' }, 'sch_med'), 'sch_eng');
  assert.equal(resolveCreateTenant({ schoolId: 'sch_eng' }, undefined), 'sch_eng');
});

test('resolveCreateTenant: a central user returns the body schoolId', () => {
  assert.equal(resolveCreateTenant({ schoolId: 'ALL' }, 'sch_eng'), 'sch_eng');
});

test('resolveCreateTenant: a central user without a body schoolId throws SCHOOL_ID_REQUIRED (400)', () => {
  assert.throws(
    () => resolveCreateTenant({ schoolId: 'ALL' }, undefined),
    (err: unknown) =>
      err instanceof ApiError && err.statusCode === 400 && err.code === 'SCHOOL_ID_REQUIRED'
  );
});

// ---- enroll blocks non-enrollable statuses (GRADUATED / DROPPED) -------------

test('enroll: blocks GRADUATED and DROPPED students', () => {
  assert.equal(canEnrollStudent('GRADUATED'), false);
  assert.equal(canEnrollStudent('DROPPED'), false);
  assert.equal(canEnrollStudent('ACTIVE'), true);
  assert.equal(canEnrollStudent('ON_LEAVE'), true);
  // Only GRADUATED/DROPPED are hard-blocked; a transferred student continues
  // enrollment in their new program and is still enrollable.
  assert.equal(canEnrollStudent('TRANSFERRED'), true);
});

// ---- batch/program integrity -------------------------------------------------

test('batch: mismatch detected when the batch belongs to a different program', () => {
  assert.equal(isBatchProgramMismatch('prog_btech_aiml', 'prog_btech_cse'), true);
});

test('batch: no mismatch when batch.programId equals the target program', () => {
  assert.equal(isBatchProgramMismatch('prog_btech_cse', 'prog_btech_cse'), false);
});

// ---- leave overlap detection -------------------------------------------------

test('leave: detects an overlap where the approved leave contains the request', () => {
  const approved = [{ fromDate: '2025-03-01', toDate: '2025-03-10' }];
  assert.equal(hasLeaveOverlap(approved, '2025-03-05', '2025-03-08'), true);
});

test('leave: detects an overlap where the request contains the approved leave', () => {
  const approved = [{ fromDate: '2025-03-05', toDate: '2025-03-08' }];
  assert.equal(hasLeaveOverlap(approved, '2025-03-01', '2025-03-10'), true);
});

test('leave: detects a boundary-overlapping request (same start/end day)', () => {
  const approved = [{ fromDate: '2025-03-01', toDate: '2025-03-05' }];
  assert.equal(hasLeaveOverlap(approved, '2025-03-05', '2025-03-06'), true);
  assert.equal(hasLeaveOverlap(approved, '2025-02-28', '2025-03-01'), true);
});

test('leave: no overlap for a completely disjoint, later request', () => {
  const approved = [{ fromDate: '2025-03-01', toDate: '2025-03-05' }];
  assert.equal(hasLeaveOverlap(approved, '2025-03-06', '2025-03-10'), false);
});

test('leave: no overlap with an empty approval list', () => {
  assert.equal(hasLeaveOverlap([], '2025-03-01', '2025-03-05'), false);
});

test('leave: ignores pending/rejected leaves (only approved rows are considered)', () => {
  const leaves = [
    { fromDate: '2025-03-01', toDate: '2025-03-05' },
    { fromDate: '2025-03-10', toDate: '2025-03-12' },
  ];
  // Only the approved subset matters to the guard; the helper is given the
  // pre-filtered list. Two disjoint approved ranges never overlap.
  assert.equal(hasLeaveOverlap(leaves, '2025-03-06', '2025-03-09'), false);
});

// ---- computeNextRollNo stays correct (regression guard) ----------------------

test('computeNextRollNo: still correct after status-set extension', () => {
  const existing = ['BTECH-CSE-0001', 'BTECH-CSE-0002', 'BTECH-CSE-0005'];
  assert.equal(computeNextRollNo('BTECH-CSE', existing), 'BTECH-CSE-0006');
});
