import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  timeToMinutes,
  intervalsOverlap,
  detectSlotConflicts,
  hasConflict,
  canManageEvent,
  canManageSlot,
  resolveCreateTenant,
} from '../academic-core';
import { ApiError } from '../errors';
import { hasPermission } from '../perms';
import { createEventSchema, updateEventSchema, createSlotSchema } from '../academic-schemas';

// ---- timeToMinutes ----------------------------------------------------------

test('timeToMinutes: "HH:mm" converts to minutes since midnight', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('09:00'), 540);
  assert.equal(timeToMinutes('10:30'), 630);
  assert.equal(timeToMinutes('23:59'), 1439);
  assert.equal(timeToMinutes('9:00'), 540); // single-digit hour tolerated
});

test('timeToMinutes: rejects malformed times with ApiError INVALID_TIME', () => {
  assert.throws(() => timeToMinutes('24:00'), (e) => e instanceof ApiError && e.code === 'INVALID_TIME');
  assert.throws(() => timeToMinutes('10:60'), (e) => e instanceof ApiError && e.code === 'INVALID_TIME');
  assert.throws(() => timeToMinutes('abc'), (e) => e instanceof ApiError && e.code === 'INVALID_TIME');
  assert.throws(() => timeToMinutes(''), (e) => e instanceof ApiError && e.code === 'INVALID_TIME');
});

// ---- intervalsOverlap -------------------------------------------------------

test('intervalsOverlap: half-open [s,e) overlap rule', () => {
  assert.equal(intervalsOverlap(540, 600, 600, 660), false); // adjacent, no overlap
  assert.equal(intervalsOverlap(600, 660, 540, 600), false); // adjacent, reversed
  assert.equal(intervalsOverlap(540, 600, 550, 610), true); // partial overlap
  assert.equal(intervalsOverlap(540, 600, 500, 550), true); // partial overlap (early)
  assert.equal(intervalsOverlap(540, 600, 500, 700), true); // containment
  assert.equal(intervalsOverlap(540, 600, 540, 600), true); // exact same
  assert.equal(intervalsOverlap(600, 660, 540, 600), false); // touching at boundary
});

// ---- detectSlotConflicts ----------------------------------------------------

const FAC_A = 'fac_a';
const FAC_B = 'fac_b';
const CLASS_1 = 'class_1';
const CLASS_2 = 'class_2';

const existingSlots = [
  { id: 's1', classGroupId: CLASS_1, dayOfWeek: 1, startTime: '09:00', endTime: '10:00', facultyUserId: FAC_A, room: 'LT-101' },
  { id: 's2', classGroupId: CLASS_2, dayOfWeek: 1, startTime: '09:00', endTime: '10:00', facultyUserId: FAC_A, room: 'LT-102' },
  { id: 's3', classGroupId: CLASS_2, dayOfWeek: 2, startTime: '09:00', endTime: '10:00', facultyUserId: FAC_B, room: 'LT-101' },
];

test('detectSlotConflicts: class double-book (same class, same day, overlap)', () => {
  const slot = { classGroupId: CLASS_1, dayOfWeek: 1, startTime: '09:30', endTime: '10:30', facultyUserId: FAC_B, room: 'LT-200' };
  const conflicts = detectSlotConflicts(slot, existingSlots);
  assert.ok(conflicts.some((c) => c.type === 'CLASS' && c.slotId === 's1'));
  assert.equal(conflicts.some((c) => c.type === 'FACULTY'), false);
  assert.equal(conflicts.some((c) => c.type === 'ROOM'), false);
});

test('detectSlotConflicts: faculty double-book (same faculty, same day, overlap)', () => {
  const slot = { classGroupId: CLASS_1, dayOfWeek: 1, startTime: '09:30', endTime: '10:30', facultyUserId: FAC_A, room: 'LT-200' };
  const conflicts = detectSlotConflicts(slot, existingSlots);
  assert.ok(conflicts.some((c) => c.type === 'FACULTY' && c.slotId === 's1'));
  assert.ok(conflicts.some((c) => c.type === 'FACULTY' && c.slotId === 's2'));
  assert.ok(conflicts.some((c) => c.type === 'CLASS'));
});

test('detectSlotConflicts: room double-book (same room, same day, overlap)', () => {
  const slot = { classGroupId: CLASS_2, dayOfWeek: 1, startTime: '09:30', endTime: '10:30', facultyUserId: FAC_B, room: 'LT-102' };
  const conflicts = detectSlotConflicts(slot, existingSlots);
  assert.ok(conflicts.some((c) => c.type === 'ROOM' && c.slotId === 's2'));
});

test('detectSlotConflicts: adjacent intervals do NOT conflict', () => {
  const slot = { classGroupId: CLASS_1, dayOfWeek: 1, startTime: '10:00', endTime: '11:00', facultyUserId: FAC_A, room: 'LT-101' };
  assert.equal(detectSlotConflicts(slot, existingSlots).length, 0);
});

test('detectSlotConflicts: different day does NOT conflict', () => {
  const slot = { classGroupId: CLASS_1, dayOfWeek: 3, startTime: '09:00', endTime: '10:00', facultyUserId: FAC_A, room: 'LT-101' };
  assert.equal(detectSlotConflicts(slot, existingSlots).length, 0);
});

test('detectSlotConflicts: null/empty rooms never conflict on ROOM', () => {
  const slot = { classGroupId: CLASS_1, dayOfWeek: 1, startTime: '09:30', endTime: '10:30', facultyUserId: FAC_B, room: null };
  const conflicts = detectSlotConflicts(slot, existingSlots);
  assert.equal(conflicts.some((c) => c.type === 'ROOM'), false);
});

test('hasConflict: true when any conflict, false when clean', () => {
  const clashing = { classGroupId: CLASS_1, dayOfWeek: 1, startTime: '09:30', endTime: '10:30', facultyUserId: FAC_B, room: 'LT-200' };
  const clean = { classGroupId: CLASS_1, dayOfWeek: 1, startTime: '10:00', endTime: '11:00', facultyUserId: FAC_B, room: 'LT-200' };
  assert.equal(hasConflict(clashing, existingSlots), true);
  assert.equal(hasConflict(clean, existingSlots), false);
});

// ---- resolveCreateTenant (shared tenant resolver) ---------------------------

test('resolveCreateTenant: school-scoped user resolves own school', () => {
  assert.equal(resolveCreateTenant({ schoolId: 'sch_eng' }, 'sch_other'), 'sch_eng');
});

test('resolveCreateTenant: central user requires explicit schoolId', () => {
  assert.throws(() => resolveCreateTenant({ schoolId: 'ALL' }, undefined), (e) => e instanceof ApiError && e.code === 'SCHOOL_ID_REQUIRED');
  assert.equal(resolveCreateTenant({ schoolId: 'ALL' }, 'sch_med'), 'sch_med');
});

// ---- Zod schema validation ---------------------------------------------------

test('createEventSchema: rejects endDate before startDate', () => {
  assert.throws(() =>
    createEventSchema.parse({ schoolId: 'sch_eng', title: 'x', type: 'EVENT', startDate: '2024-12-10', endDate: '2024-12-09' })
  );
});

test('createEventSchema: accepts valid school-wide event', () => {
  const parsed = createEventSchema.parse({ title: 'Semester Begins', type: 'EVENT', startDate: '2024-07-22' });
  assert.equal(parsed.type, 'EVENT');
  assert.equal(parsed.endDate, undefined);
});

test('createEventSchema: rejects invalid type', () => {
  assert.throws(() => createEventSchema.parse({ title: 'x', type: 'PARTY', startDate: '2024-07-22' }));
});

test('createSlotSchema: rejects endTime before startTime', () => {
  assert.throws(() =>
    createSlotSchema.parse({
      classGroupId: 'cg', dayOfWeek: 1, startTime: '11:00', endTime: '09:00',
      courseId: 'c', facultyUserId: 'f', semester: 1, academicYear: '2024-2025',
    })
  );
});

test('createSlotSchema: rejects malformed time', () => {
  assert.throws(() =>
    createSlotSchema.parse({
      classGroupId: 'cg', dayOfWeek: 1, startTime: '9:00', endTime: '10:00',
      courseId: 'c', facultyUserId: 'f', semester: 1, academicYear: '2024-2025',
    })
  );
});

test('createSlotSchema: rejects dayOfWeek out of range', () => {
  assert.throws(() =>
    createSlotSchema.parse({
      classGroupId: 'cg', dayOfWeek: 7, startTime: '09:00', endTime: '10:00',
      courseId: 'c', facultyUserId: 'f', semester: 1, academicYear: '2024-2025',
    })
  );
  assert.throws(() =>
    createSlotSchema.parse({
      classGroupId: 'cg', dayOfWeek: 0, startTime: '09:00', endTime: '10:00',
      courseId: 'c', facultyUserId: 'f', semester: 1, academicYear: '2024-2025',
    })
  );
});

test('createSlotSchema: accepts valid slot', () => {
  const parsed = createSlotSchema.parse({
    classGroupId: 'cg', dayOfWeek: 3, startTime: '09:00', endTime: '10:00',
    courseId: 'c', facultyUserId: 'f', room: 'LT-101', semester: 1, academicYear: '2024-2025',
  });
  assert.equal(parsed.room, 'LT-101');
});

test('updateEventSchema: rejects empty body', () => {
  assert.throws(() => updateEventSchema.parse({}));
});

// ---- Permission gating (perms.ts grants) -------------------------------------

test('permissions: staff + students can view calendar/timetable', () => {
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'calendar.view'), true);
  assert.equal(hasPermission('DEAN', 'HOD', 'timetable.view'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', null, 'calendar.view'), true);
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'calendar.view'), true);
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'timetable.view'), true);
});

test('permissions: calendar.manage granted to expected role/positions', () => {
  assert.equal(hasPermission('REGISTRAR_ADMIN', null, 'calendar.manage'), true);
  assert.equal(hasPermission('DEAN', 'HOD', 'calendar.manage'), true);
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'DEPARTMENT_SECRETARY', 'calendar.manage'), true);
  assert.equal(hasPermission('FACULTY', 'PROGRAM_COORDINATOR', 'calendar.manage'), true);
  // Not granted to plain faculty / students / class coordinators.
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'calendar.manage'), false);
  assert.equal(hasPermission('FACULTY', 'CLASS_COORDINATOR', 'calendar.manage'), false);
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'calendar.manage'), false);
});

test('permissions: timetable.manage granted to expected role/positions', () => {
  assert.equal(hasPermission('REGISTRAR_ADMIN', null, 'timetable.manage'), true);
  assert.equal(hasPermission('DEAN', 'HOD', 'timetable.manage'), true);
  assert.equal(hasPermission('FACULTY', 'PROGRAM_COORDINATOR', 'timetable.manage'), true);
  assert.equal(hasPermission('FACULTY', 'CLASS_COORDINATOR', 'timetable.manage'), true);
  assert.equal(hasPermission('FACULTY', 'SUBJECT_TEACHER', 'timetable.manage'), false);
  // Department secretary sits under the registrar base role, so it inherits the
  // role-fallback grant (consistent with the RBAC model).
  assert.equal(hasPermission('REGISTRAR_ADMIN', 'DEPARTMENT_SECRETARY', 'timetable.manage'), true);
  assert.equal(hasPermission('STUDENT', 'STUDENT', 'timetable.manage'), false);
});

// ---- Ownership helpers -------------------------------------------------------

test('canManageEvent: registrar manages any event', () => {
  const me = { id: 'u1', role: 'REGISTRAR_ADMIN', position: null, departmentId: null };
  assert.equal(canManageEvent(me, { programId: null, programCoordinatorUserId: null }), true);
  assert.equal(canManageEvent(me, { programId: 'p1', programCoordinatorUserId: 'other' }), true);
});

test('canManageEvent: program coordinator only their own program', () => {
  const me = { id: 'meena', role: 'FACULTY', position: 'PROGRAM_COORDINATOR', departmentId: 'dept' };
  assert.equal(canManageEvent(me, { programId: 'p1', programCoordinatorUserId: 'meena' }), true);
  assert.equal(canManageEvent(me, { programId: 'p1', programCoordinatorUserId: 'other' }), false);
  // Not allowed to create school-wide events (not their program).
  assert.equal(canManageEvent(me, { programId: null, programCoordinatorUserId: null }), false);
});

test('canManageEvent: HOD / secretary need a department attachment', () => {
  const hod = { id: 'u2', role: 'DEAN', position: 'HOD', departmentId: 'dept_sst_cse' };
  const hodNoDept = { id: 'u3', role: 'DEAN', position: 'HOD', departmentId: null };
  assert.equal(canManageEvent(hod, { programId: null, programCoordinatorUserId: null }), true);
  assert.equal(canManageEvent(hodNoDept, { programId: null, programCoordinatorUserId: null }), false);
  const sec = { id: 'u4', role: 'REGISTRAR_ADMIN', position: 'DEPARTMENT_SECRETARY', departmentId: 'dept_sst_cse' };
  assert.equal(canManageEvent(sec, { programId: null, programCoordinatorUserId: null }), true);
});

test('canManageSlot: class coordinator only their own class', () => {
  const me = { id: 'neha', role: 'FACULTY', position: 'CLASS_COORDINATOR', departmentId: 'dept' };
  const ownCtx = { classGroup: { coordinatorUserId: 'neha', program: { coordinatorUserId: 'x' } } };
  const otherCtx = { classGroup: { coordinatorUserId: 'someone', program: { coordinatorUserId: 'x' } } };
  assert.equal(canManageSlot(me, ownCtx), true);
  assert.equal(canManageSlot(me, otherCtx), false);
});

test('canManageSlot: program coordinator only classes in their program', () => {
  const me = { id: 'meena', role: 'FACULTY', position: 'PROGRAM_COORDINATOR', departmentId: 'dept' };
  const ownCtx = { classGroup: { coordinatorUserId: null, program: { coordinatorUserId: 'meena' } } };
  const otherCtx = { classGroup: { coordinatorUserId: null, program: { coordinatorUserId: 'other' } } };
  assert.equal(canManageSlot(me, ownCtx), true);
  assert.equal(canManageSlot(me, otherCtx), false);
});

test('canManageSlot: registrar manages any slot; HOD needs department', () => {
  const registrar = { id: 'r', role: 'REGISTRAR_ADMIN', position: null, departmentId: null };
  assert.equal(canManageSlot(registrar, { classGroup: { coordinatorUserId: null, program: { coordinatorUserId: null } } }), true);
  const hod = { id: 'h', role: 'DEAN', position: 'HOD', departmentId: 'dept_sst_cse' };
  const hodNoDept = { id: 'h2', role: 'DEAN', position: 'HOD', departmentId: null };
  assert.equal(canManageSlot(hod, { classGroup: { coordinatorUserId: null, program: { coordinatorUserId: null } } }), true);
  assert.equal(canManageSlot(hodNoDept, { classGroup: { coordinatorUserId: null, program: { coordinatorUserId: null } } }), false);
});
