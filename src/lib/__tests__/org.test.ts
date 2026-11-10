import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, LEGAL_POSITIONS } from '../perms';
import { isLegalPosition, assertLegalPosition, requirePermission, allocationKey, isSemesterValid } from '../org';
import { ApiError } from '../errors';

// ---------------------------------------------------------------------------
// Legal-position map
// ---------------------------------------------------------------------------
test('LEGAL_POSITIONS maps base roles to allowed positions', () => {
  assert.ok(LEGAL_POSITIONS.FACULTY.includes('PROGRAM_COORDINATOR'));
  assert.ok(LEGAL_POSITIONS.FACULTY.includes('CLASS_COORDINATOR'));
  assert.ok(!LEGAL_POSITIONS.FACULTY.includes('HOD'));

  assert.deepEqual(LEGAL_POSITIONS.DEAN, ['HOD']);

  assert.ok(LEGAL_POSITIONS.REGISTRAR_ADMIN.includes('DEPARTMENT_SECRETARY'));
  assert.deepEqual(LEGAL_POSITIONS.STUDENT, []);
  assert.deepEqual(LEGAL_POSITIONS.FINANCE_OFFICER, []);
});

test('isLegalPosition accepts legal positions and rejects illegal ones', () => {
  assert.equal(isLegalPosition('FACULTY', 'PROGRAM_COORDINATOR'), true);
  assert.equal(isLegalPosition('FACULTY', 'CLASS_COORDINATOR'), true);
  assert.equal(isLegalPosition('FACULTY', 'HOD'), false);
  assert.equal(isLegalPosition('DEAN', 'HOD'), true);
  assert.equal(isLegalPosition('REGISTRAR_ADMIN', 'DEPARTMENT_SECRETARY'), true);
  assert.equal(isLegalPosition('REGISTRAR_ADMIN', 'PROGRAM_COORDINATOR'), false);
  assert.equal(isLegalPosition('STUDENT', 'HOD'), false);
  assert.equal(isLegalPosition('FACULTY', null), true);
  assert.equal(isLegalPosition('FACULTY', undefined), true);
  assert.equal(isLegalPosition(null, 'HOD'), false);
});

test('assertLegalPosition throws INVALID_POSITION for illegal position', () => {
  assert.throws(() => assertLegalPosition('STUDENT', 'HOD'), (e: { code: string; statusCode: number }) => {
    assert.equal(e.code, 'INVALID_POSITION');
    assert.equal(e.statusCode, 400);
    return true;
  });
  assert.doesNotThrow(() => assertLegalPosition('DEAN', 'HOD'));
});

// ---------------------------------------------------------------------------
// New permission keys
// ---------------------------------------------------------------------------
test('org.manage granted to registrar admin and dept secretary', () => {
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'DEPARTMENT_SECRETARY', 'org.manage'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', null, 'org.manage'), true);
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'org.manage'), false);
  assert.equal(hasPermission('FACULTY', 'PROGRAM_COORDINATOR', 'org.manage'), false);
  assert.equal(hasPermission('DEAN', 'HOD', 'org.manage'), false);
});

test('org.view granted to staff roles, denied to students', () => {
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'org.view'), true);
  assert.equal(hasPermission('FACULTY', 'PROGRAM_COORDINATOR', 'org.view'), true);
  assert.equal(hasPermission('DEAN', 'HOD', 'org.view'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'DEPARTMENT_SECRETARY', 'org.view'), true);
  assert.equal(hasPermission('FINANCE_OFFICER', null, 'org.view'), true);
  assert.equal(hasPermission('EXAM_CONTROLLER', 'EXAM_CELL_CLERK', 'org.view'), true);
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'org.view'), false);
});

test('org.assign_staff granted only to registrar admin', () => {
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'DEPARTMENT_SECRETARY', 'org.assign_staff'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', null, 'org.assign_staff'), true);
  assert.equal(hasPermission('FACULTY', 'PROGRAM_COORDINATOR', 'org.assign_staff'), false);
  assert.equal(hasPermission('DEAN', 'HOD', 'org.assign_staff'), false);
});

test('org.allocate_course granted to HOD, program coordinator and registrar admin', () => {
  assert.equal(hasPermission('DEAN', 'HOD', 'org.allocate_course'), true);
  assert.equal(hasPermission('FACULTY', 'PROGRAM_COORDINATOR', 'org.allocate_course'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'DEPARTMENT_SECRETARY', 'org.allocate_course'), true);
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'org.allocate_course'), false);
  assert.equal(hasPermission('FACULTY', 'CLASS_COORDINATOR', 'org.allocate_course'), false);
});

test('org.manage_classes granted to HOD and registrar admin', () => {
  assert.equal(hasPermission('DEAN', 'HOD', 'org.manage_classes'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'DEPARTMENT_SECRETARY', 'org.manage_classes'), true);
  assert.equal(hasPermission('FACULTY', 'PROGRAM_COORDINATOR', 'org.manage_classes'), false);
  assert.equal(hasPermission('FACULTY', 'CLASS_COORDINATOR', 'org.manage_classes'), false);
});

test('existing permission behavior unchanged', () => {
  assert.equal(hasPermission('FACULTY', 'CLASS_COORDINATOR', 'marks.approve'), true);
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'marks.enter_draft'), true);
  assert.equal(hasPermission('EXAM_CONTROLLER', 'EXAM_CELL_CLERK', 'marks.publish'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'HOSTEL_ADMIN', 'hostel.manage'), true);
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'payroll.manage'), false);
});

// ---------------------------------------------------------------------------
// requirePermission
// ---------------------------------------------------------------------------
test('requirePermission throws FORBIDDEN when denied', () => {
  assert.throws(() => requirePermission({ role: 'STUDENT', position: 'STUDENT' }, 'org.view'), (e: { code: string; statusCode: number }) => {
    assert.equal(e.code, 'FORBIDDEN');
    assert.equal(e.statusCode, 403);
    return true;
  });
  assert.throws(() => requirePermission({ role: 'FACULTY', position: 'SUBJECT_TEACHER' }, 'org.manage'), ApiError);
});

test('requirePermission passes when granted', () => {
  assert.doesNotThrow(() => requirePermission({ role: 'REGISTRAR_ADMIN', position: 'DEPARTMENT_SECRETARY' }, 'org.manage'));
  assert.doesNotThrow(() => requirePermission({ role: 'DEAN', position: 'HOD' }, 'org.allocate_course'));
  assert.doesNotThrow(() => requirePermission({ role: 'FACULTY', position: 'PROGRAM_COORDINATOR' }, 'org.allocate_course'));
});

// ---------------------------------------------------------------------------
// Pure allocation helpers
// ---------------------------------------------------------------------------
test('allocationKey is deterministic and unique per course/class/semester/year', () => {
  assert.equal(allocationKey('c1', 'g1', 2, '2025-2026'), 'c1|g1|2|2025-2026');
  assert.notEqual(allocationKey('c1', 'g1', 2, '2025-2026'), allocationKey('c1', 'g1', 3, '2025-2026'));
  assert.notEqual(allocationKey('c1', 'g1', 2, '2025-2026'), allocationKey('c2', 'g1', 2, '2025-2026'));
  assert.notEqual(allocationKey('c1', 'g1', 2, '2025-2026'), allocationKey('c1', 'g2', 2, '2025-2026'));
});

test('isSemesterValid rejects non-positive/non-integer semesters', () => {
  assert.equal(isSemesterValid(1), true);
  assert.equal(isSemesterValid(8), true);
  assert.equal(isSemesterValid(0), false);
  assert.equal(isSemesterValid(-2), false);
  assert.equal(isSemesterValid(2.5), false);
});
