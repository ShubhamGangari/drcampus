import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    canDelegate,
    delegateDenialReason,
    rankOf,
    createableRoles,
    canCreateAny,
    canManageAllDepartments,
    scopeLabel,
    BUILTIN_ROLES,
} from '../delegate';

// Actor helpers ---------------------------------------------------------------
function dean(dept = 'dept-a'): { role: string; position: string; schoolId: string; departmentId: string } {
    return { role: 'DEAN', position: 'HOD', schoolId: 'school-1', departmentId: dept };
}
function subjectTeacher(dept = 'dept-a'): { role: string; position: string; schoolId: string; departmentId: string } {
    return { role: 'FACULTY', position: 'SUBJECT_TEACHER', schoolId: 'school-1', departmentId: dept };
}
function programCoordinator(dept = 'dept-a'): { role: string; position: string; schoolId: string; departmentId: string } {
    return { role: 'FACULTY', position: 'PROGRAM_COORDINATOR', schoolId: 'school-1', departmentId: dept };
}
function registrar(): { role: string; position: string | null; schoolId: string; departmentId: string | null } {
    return { role: 'REGISTRAR_ADMIN', position: null, schoolId: 'school-1', departmentId: null };
}
function student(): { role: string; position: string | null; schoolId: string; departmentId: string | null } {
    return { role: 'STUDENT', position: null, schoolId: 'school-1', departmentId: 'dept-a' };
}
function parent(): { role: string; position: string | null; schoolId: string; departmentId: string | null } {
    return { role: 'PARENT', position: null, schoolId: 'school-1', departmentId: null };
}

// rankOf ----------------------------------------------------------------------
test('rankOf: SUPER_ADMIN is the single top head (0)', () => {
    assert.equal(rankOf('SUPER_ADMIN'), 0);
});
test('rankOf: registrar is rank 1 regardless of legal position', () => {
    assert.equal(rankOf('REGISTRAR_ADMIN'), 1);
    assert.equal(rankOf('REGISTRAR_ADMIN', 'ADMISSIONS_OFFICER'), 1);
});
test('rankOf: dean is rank 2 (HOD)', () => {
    assert.equal(rankOf('DEAN', 'HOD'), 2);
});
test('rankOf: faculty positions rank 4 for coordinators, 5 for subject teacher', () => {
    assert.equal(rankOf('FACULTY', 'PROGRAM_COORDINATOR'), 4);
    assert.equal(rankOf('FACULTY', 'CLASS_COORDINATOR'), 4);
    assert.equal(rankOf('FACULTY', 'SUBJECT_TEACHER'), 5);
    assert.equal(rankOf('FACULTY'), 5); // default resolves to subject teacher
});
test('rankOf: student/parent rank 6', () => {
    assert.equal(rankOf('STUDENT'), 6);
    assert.equal(rankOf('PARENT'), 6);
});

// canDelegate — acceptance criteria §7.1 --------------------------------------
test('dean creates faculty in the same department → allowed', () => {
    assert.equal(canDelegate(dean('dept-a'), subjectTeacher('dept-a')), true);
});
test('dean creates faculty in another department → denied', () => {
    assert.equal(canDelegate(dean('dept-a'), subjectTeacher('dept-b')), false);
    assert.equal(delegateDenialReason(dean('dept-a'), subjectTeacher('dept-b')), 'different-department');
});
test('registrar creates dean anywhere in the school → allowed', () => {
    assert.equal(canDelegate(registrar(), { role: 'DEAN', position: 'HOD', schoolId: 'school-1', departmentId: 'dept-z' }), true);
});
test('subject teacher creates another subject teacher (same dept) → allowed', () => {
    assert.equal(canDelegate(subjectTeacher('dept-a'), subjectTeacher('dept-a')), true);
});
test('program coordinator can create a subject teacher', () => {
    assert.equal(canDelegate(programCoordinator('dept-a'), subjectTeacher('dept-a')), true);
});
test('faculty creates a dean → denied (higher rank)', () => {
    assert.equal(canDelegate(subjectTeacher('dept-a'), { role: 'DEAN', position: 'HOD', schoolId: 'school-1', departmentId: 'dept-a' }), false);
    assert.equal(delegateDenialReason(subjectTeacher('dept-a'), { role: 'DEAN', position: 'HOD', schoolId: 'school-1', departmentId: 'dept-a' }), 'target-higher-rank');
});
test('student cannot create anything', () => {
    assert.equal(canDelegate(student(), subjectTeacher('dept-a')), false);
    assert.equal(canDelegate(student(), student()), false);
});
test('parent cannot create anything', () => {
    assert.equal(canDelegate(parent(), subjectTeacher('dept-a')), false);
});
test('nobody can create a SUPER_ADMIN', () => {
    const superTarget = { role: 'SUPER_ADMIN', position: null, schoolId: 'school-1', departmentId: null };
    assert.equal(canDelegate(registrar(), superTarget), false);
    assert.equal(canDelegate({ role: 'SUPER_ADMIN', position: null, schoolId: 'school-1', departmentId: null }, superTarget), false);
    assert.equal(delegateDenialReason(registrar(), superTarget), 'target-super-admin');
});
test('dean cannot create a registrar (higher rank)', () => {
    assert.equal(canDelegate(dean('dept-a'), registrar()), false);
});
test('dean can create a student in their department (equal-below rank)', () => {
    assert.equal(canDelegate(dean('dept-a'), student()), true);
});
test('cross-school is denied', () => {
    assert.equal(
        canDelegate(registrar(), { role: 'DEAN', position: 'HOD', schoolId: 'school-2', departmentId: 'dept-a' }),
        false
    );
});
test('illegal position for the target role is denied', () => {
    assert.equal(canDelegate(dean('dept-a'), { role: 'FACULTY', position: 'HOD', schoolId: 'school-1', departmentId: 'dept-a' }), false);
    assert.equal(
        delegateDenialReason(dean('dept-a'), { role: 'FACULTY', position: 'HOD', schoolId: 'school-1', departmentId: 'dept-a' }),
        'illegal-position'
    );
});
test('unspecified target department defaults to the actor department for dean/faculty', () => {
    assert.equal(canDelegate(dean('dept-a'), { role: 'FACULTY', position: 'SUBJECT_TEACHER', schoolId: 'school-1', departmentId: null }), true);
});

// createableRoles --------------------------------------------------------------
test('dean can create roles at-or-below rank 2 and no SUPER_ADMIN', () => {
    const roles = createableRoles(dean('dept-a'));
    const names: string[] = roles.map((r) => r.role);
    assert.ok(names.includes('FACULTY'));
    assert.ok(names.includes('EXAM_CONTROLLER'));
    assert.ok(names.includes('FINANCE_OFFICER'));
    assert.ok(names.includes('DEAN'));
    assert.ok(names.includes('STUDENT'));
    assert.ok(!names.includes('REGISTRAR_ADMIN'));
    assert.ok(!names.includes('SUPER_ADMIN'));
});
test('dean faculty positions are rank-filtered (all legal faculty positions)', () => {
    const roles = createableRoles(dean('dept-a'));
    const faculty = roles.find((r) => r.role === 'FACULTY');
    assert.deepEqual([...faculty!.positions].sort(), ['CLASS_COORDINATOR', 'PROGRAM_COORDINATOR', 'SUBJECT_TEACHER'].sort());
});
test('subject teacher can only create roles at-or-below rank 5', () => {
    const roles = createableRoles(subjectTeacher('dept-a'));
    const names: string[] = roles.map((r) => r.role);
    assert.ok(names.includes('FACULTY'));
    assert.ok(names.includes('STUDENT'));
    assert.ok(!names.includes('DEAN'));
    assert.ok(!names.includes('EXAM_CONTROLLER'));
    assert.ok(!names.includes('FINANCE_OFFICER'));
    assert.ok(!names.includes('REGISTRAR_ADMIN'));
});
test('subject teacher faculty positions collapse to subject teacher only', () => {
    const roles = createableRoles(subjectTeacher('dept-a'));
    const faculty = roles.find((r) => r.role === 'FACULTY');
    assert.deepEqual(faculty!.positions, ['SUBJECT_TEACHER']);
});
test('student cannot create any role', () => {
    assert.equal(createableRoles(student()).length, 0);
    assert.equal(canCreateAny(student()), false);
});
test('super admin can create every built-in role', () => {
    const roles = createableRoles({ role: 'SUPER_ADMIN', position: null, schoolId: 'school-1', departmentId: null });
    assert.equal(roles.length, BUILTIN_ROLES.length);
});

// canManageAllDepartments + scopeLabel ------------------------------------------
test('only SUPER_ADMIN / REGISTRAR_ADMIN can manage all departments', () => {
    assert.equal(canManageAllDepartments(dean('dept-a')), false);
    assert.equal(canManageAllDepartments(subjectTeacher('dept-a')), false);
    assert.equal(canManageAllDepartments(registrar()), true);
    assert.equal(canManageAllDepartments({ role: 'SUPER_ADMIN' }), true);
});
test('scopeLabel reflects role + division', () => {
    assert.equal(scopeLabel(dean('dept-a'), 'Computer Science'), 'Division: Computer Science');
    assert.equal(scopeLabel(registrar()), 'Entire school');
    assert.equal(scopeLabel({ role: 'SUPER_ADMIN' }), 'All schools & divisions');
});
