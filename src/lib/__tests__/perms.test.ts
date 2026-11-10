import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  hasAnyPermission,
  hasEffectivePermission,
  guardRole,
  resolveEffectivePermissions,
  parseRolePermissions,
  serializeRolePermissions,
  isPermission,
  PERMISSION_CATALOG,
  ALL_PERMISSIONS,
  LEGAL_POSITIONS,
  type Permission,
} from '../perms';

test('subject teacher can enter draft marks', () => {
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'marks.enter_draft'), true);
});

test('subject teacher CANNOT approve marks', () => {
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'marks.approve'), false);
});

test('class coordinator CAN approve marks', () => {
  assert.equal(hasPermission('FACULTY', 'CLASS_COORDINATOR', 'marks.approve'), true);
});

test('exam controller can publish + approve', () => {
  assert.equal(hasPermission('EXAM_CONTROLLER', 'EXAM_CELL_CLERK', 'marks.publish'), true);
  assert.equal(hasPermission('EXAM_CONTROLLER', 'EXAM_CELL_CLERK', 'marks.approve'), true);
});

test('dean/HOD can view reports + results', () => {
  assert.equal(hasPermission('DEAN', 'HOD', 'report.view'), true);
  assert.equal(hasPermission('DEAN', 'HOD', 'results.view'), true);
});

test('student has no admin permissions', () => {
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'hostel.manage'), false);
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'payroll.manage'), false);
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'marks.approve'), false);
});

test('unknown role denied', () => {
  assert.equal(hasPermission('SUPERUSER', null, 'report.view'), false);
});

test('null position falls back to base default (FACULTY -> subject teacher)', () => {
  assert.equal(hasPermission('FACULTY', null, 'marks.enter_draft'), true);
  assert.equal(hasPermission('FACULTY', null, 'marks.approve'), false);
});

test('hostel admin can manage hostel', () => {
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'HOSTEL_ADMIN', 'hostel.manage'), true);
});

test('admissions officer can manage admissions', () => {
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'ADMISSIONS_OFFICER', 'admissions.manage'), true);
});

test('registrar base role can manage payroll/reports', () => {
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'REGISTRAR_ADMIN', 'payroll.manage'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', null, 'report.view'), true);
});

test('hasAnyPermission true when any matches', () => {
  assert.equal(hasAnyPermission('FACULTY', 'SUBJECT_TEACHER', ['marks.approve', 'marks.enter_draft']), true);
});

test('hasAnyPermission false when none match', () => {
  assert.equal(hasAnyPermission('FACULTY', 'SUBJECT_TEACHER', ['marks.publish']), false);
});

test('missing permission arg denies', () => {
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', undefined), false);
});

// ---------------------------------------------------------------------------
// Dynamic RBAC: SUPER_ADMIN bypass
// ---------------------------------------------------------------------------

test('SUPER_ADMIN bypasses every permission check (any catalog permission)', () => {
  assert.equal(hasPermission('SUPER_ADMIN', null, 'hostel.manage'), true);
  assert.equal(hasPermission('SUPER_ADMIN', null, 'payroll.approve'), true);
  assert.equal(hasPermission('SUPER_ADMIN', null, 'dashboard.kpi'), true);
});

test('SUPER_ADMIN bypass is a pure role check (true on any string)', () => {
  // Bypass returns true even for a non-catalog string (spec §7.1).
  assert.equal(hasPermission('SUPER_ADMIN', null, 'not-a-permission' as Permission), true);
});

test('resolveEffectivePermissions returns ALL catalog permissions for SUPER_ADMIN', () => {
  const effective = resolveEffectivePermissions({ role: 'SUPER_ADMIN' });
  assert.equal(effective.includes('hostel.manage'), true);
  assert.equal(effective.includes('attendance.mark'), true);
  assert.equal(effective.length, ALL_PERMISSIONS.size);
});

test('hasEffectivePermission(a, anyCatalogPermission) true for SUPER_ADMIN effective set', () => {
  const effective = resolveEffectivePermissions({ role: 'SUPER_ADMIN' });
  assert.equal(hasEffectivePermission(effective, 'payroll.manage'), true);
});

test('guardRole allows SUPER_ADMIN regardless of allowed list', () => {
  assert.equal(guardRole('SUPER_ADMIN', 'REGISTRAR_ADMIN'), true);
  assert.equal(guardRole('SUPER_ADMIN', 'FACULTY'), true);
  assert.equal(guardRole('SUPER_ADMIN'), true);
});

test('guardRole denies non-allowed non-SUPER_ADMIN roles', () => {
  assert.equal(guardRole('FACULTY', 'REGISTRAR_ADMIN'), false);
  assert.equal(guardRole(null), false);
  assert.equal(guardRole('FACULTY', 'FACULTY'), true);
});

// ---------------------------------------------------------------------------
// Dynamic RBAC: custom-role replace semantics
// ---------------------------------------------------------------------------

test('custom role replaces built-in static grants (exactly its permissions)', () => {
  const effective = resolveEffectivePermissions({
    role: 'REGISTRAR_ADMIN',
    customRoleId: 'r_hostel',
    customRolePermissions: ['hostel.manage', 'admissions.manage'],
  });
  assert.deepEqual(effective, ['hostel.manage', 'admissions.manage']);
  // REGISTRAR_ADMIN normally has payroll.manage — must NOT be present (replace).
  assert.equal(effective.includes('payroll.manage'), false);
});

test('custom role permits access to its permissions only', () => {
  const effective = resolveEffectivePermissions({
    role: 'REGISTRAR_ADMIN',
    customRoleId: 'r_hostel',
    customRolePermissions: ['hostel.manage'],
  });
  assert.equal(hasEffectivePermission(effective, 'hostel.manage'), true);
  assert.equal(hasEffectivePermission(effective, 'payroll.manage'), false);
});

test('empty custom-role permissions grant nothing', () => {
  const effective = resolveEffectivePermissions({
    role: 'REGISTRAR_ADMIN',
    customRoleId: 'r_empty',
    customRolePermissions: [],
  });
  assert.deepEqual(effective, []);
});

test('no custom role => static matrix used', () => {
  const effective = resolveEffectivePermissions({ role: 'REGISTRAR_ADMIN', position: null });
  assert.equal(effective.includes('payroll.manage'), true);
});

test('custom role permissions are sanitized to catalog subset', () => {
  const effective = resolveEffectivePermissions({
    role: 'FACULTY',
    customRoleId: 'r_bad',
    customRolePermissions: ['hostel.manage', 'not-a-permission', 'attendance.mark'],
  });
  assert.deepEqual(effective, ['hostel.manage', 'attendance.mark']);
});

// ---------------------------------------------------------------------------
// Dynamic RBAC: legal-position validation
// ---------------------------------------------------------------------------

test('legal positions are defined per base role', () => {
  assert.deepEqual(LEGAL_POSITIONS.FACULTY, ['SUBJECT_TEACHER', 'CLASS_COORDINATOR', 'PROGRAM_COORDINATOR']);
  assert.deepEqual(LEGAL_POSITIONS.DEAN, ['HOD']);
  assert.deepEqual(LEGAL_POSITIONS.STUDENT, []);
  assert.deepEqual(LEGAL_POSITIONS.SUPER_ADMIN, []);
});

test('unknown/invalid position falls back to base-role default', () => {
  // FACULTY default = SUBJECT_TEACHER → can enter draft marks, cannot approve.
  assert.equal(hasPermission('FACULTY', 'NOT_A_POSITION', 'marks.enter_draft'), true);
  assert.equal(hasPermission('FACULTY', 'NOT_A_POSITION', 'marks.approve'), false);
});

test('legal position grants combine with base fallback', () => {
  // CLASS_COORDINATOR adds marks.approve for FACULTY.
  assert.equal(hasPermission('FACULTY', 'CLASS_COORDINATOR', 'marks.approve'), true);
  // HOD (DEAN) gets attendance.view_all + results.view.
  assert.equal(hasPermission('DEAN', 'HOD', 'attendance.view_all'), true);
});

// ---------------------------------------------------------------------------
// Dynamic RBAC: catalog-subset validation
// ---------------------------------------------------------------------------

test('PERMISSION_CATALOG keys are all valid catalog permissions', () => {
  const keys = PERMISSION_CATALOG.flatMap((a) => a.permissions.map((p) => p.key));
  assert.equal(keys.every((k) => ALL_PERMISSIONS.has(k)), true);
  assert.equal(new Set(keys).size, keys.length); // no duplicate keys
});

test('parseRolePermissions drops non-catalog strings', () => {
  assert.deepEqual(parseRolePermissions(JSON.stringify(['hostel.manage', 'bad.perm'])), ['hostel.manage']);
  assert.deepEqual(parseRolePermissions(JSON.stringify(['attendance.mark'])), ['attendance.mark']);
});

test('parseRolePermissions handles null/empty/invalid JSON gracefully', () => {
  assert.deepEqual(parseRolePermissions(null), []);
  assert.deepEqual(parseRolePermissions(undefined), []);
  assert.deepEqual(parseRolePermissions('not json'), []);
  assert.deepEqual(parseRolePermissions(''), []);
});

test('serializeRolePermissions only serializes valid catalog permissions', () => {
  assert.equal(serializeRolePermissions(['hostel.manage', 'nope'] as Permission[]), '["hostel.manage"]');
});

test('isPermission returns true only for catalog keys', () => {
  assert.equal(isPermission('hostel.manage'), true);
  assert.equal(isPermission('not-a-permission'), false);
});
