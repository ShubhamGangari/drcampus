// ==============================================================================
// Academic Calendar & Timetable module (Deep Core) — backend business logic.
// Pure, DB-free functions (time math, slot conflict detection, ownership rules)
// live here so the tester can unit-test them without a database. Thin DB
// helpers used by the API routes are kept separate / minimal.
//
// Conflict rule (spec §6): two weekly intervals [s1,e1) and [s2,e2) overlap iff
// s1 < e2 && s2 < e1. A slot conflicts when it overlaps on the same dayOfWeek
// with (a) the same class group, (b) the same faculty member, or (c) the same
// room. Adjacent intervals (e.g. 09:00-10:00 vs 10:00-11:00) do NOT conflict.
// ==============================================================================

import { hasPermission } from './perms';
import { ApiError } from './errors';

/** Re-exported tenant resolver (shared with fees/exams/students modules). */
export { resolveCreateTenant } from './fee-core';

// ---- Time helpers ------------------------------------------------------------

/** "HH:mm" (24h) → minutes since midnight. Throws ApiError on malformed input. */
export function timeToMinutes(time: string): number {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(time).trim());
  if (!m) {
    throw new ApiError(400, 'INVALID_TIME', `Invalid time "${String(time)}" (expected HH:mm)`);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Half-open interval overlap: [s1,e1) ∩ [s2,e2) ≠ ∅. */
export function intervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

// ---- Slot conflict detection -------------------------------------------------

export type ConflictType = 'CLASS' | 'FACULTY' | 'ROOM';

export interface SlotConflict {
  type: ConflictType;
  slotId: string;
  detail: string;
}

export interface SlotLike {
  id?: string;
  classGroupId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  facultyUserId: string;
  room?: string | null;
}

/**
 * Detect conflicts between a prospective slot and existing slots.
 * Each clashing existing slot contributes one conflict per violated constraint
 * (class / faculty / room). Returns an empty array when the slot is clean.
 */
export function detectSlotConflicts(slot: SlotLike, existingSlots: SlotLike[]): SlotConflict[] {
  const conflicts: SlotConflict[] = [];
  const s1 = timeToMinutes(slot.startTime);
  const e1 = timeToMinutes(slot.endTime);

  for (const other of existingSlots) {
    if (other.dayOfWeek !== slot.dayOfWeek) continue;

    const s2 = timeToMinutes(other.startTime);
    const e2 = timeToMinutes(other.endTime);
    if (!intervalsOverlap(s1, e1, s2, e2)) continue;

    if (other.classGroupId === slot.classGroupId) {
      conflicts.push({
        type: 'CLASS',
        slotId: other.id ?? '',
        detail: 'This class group is already scheduled in this time window',
      });
    }
    if (other.facultyUserId === slot.facultyUserId) {
      conflicts.push({
        type: 'FACULTY',
        slotId: other.id ?? '',
        detail: 'This faculty member already has a class in this time window',
      });
    }
    if (slot.room && other.room && other.room === slot.room) {
      conflicts.push({
        type: 'ROOM',
        slotId: other.id ?? '',
        detail: 'This room is already booked in this time window',
      });
    }
  }

  return conflicts;
}

/** Convenience: true when a prospective slot clashes with any existing slot. */
export function hasConflict(slot: SlotLike, existingSlots: SlotLike[]): boolean {
  return detectSlotConflicts(slot, existingSlots).length > 0;
}

// ---- Ownership / permission rules (pure, testable) ----------------------------

/** Minimal acting-user shape needed for ownership decisions. */
export interface ManagerContext {
  id: string;
  role: string | null;
  position: string | null;
  departmentId?: string | null;
}

/** Minimal event shape needed for calendar ownership decisions. */
export interface EventOwnerCtx {
  programId?: string | null;
  programCoordinatorUserId?: string | null;
}

/**
 * May `me` manage a calendar event?
 * - REGISTRAR_ADMIN: always (school-wide).
 * - PROGRAM_COORDINATOR: only events of the program they coordinate.
 * - HOD / DEPARTMENT_SECRETARY: school events, provided they are attached to a
 *   department (their school-dept scope).
 */
export function canManageEvent(me: ManagerContext, event: EventOwnerCtx): boolean {
  if (!hasPermission(me.role, me.position, 'calendar.manage')) return false;
  if (me.role === 'REGISTRAR_ADMIN') return true;
  if (me.position === 'PROGRAM_COORDINATOR') {
    if (!event.programId) return false;
    return event.programCoordinatorUserId === me.id;
  }
  if (me.position === 'HOD' || me.position === 'DEPARTMENT_SECRETARY') {
    return Boolean(me.departmentId);
  }
  return false;
}

/** Guard version of {@link canManageEvent} (throws 403). */
export function requireManageEvent(me: ManagerContext, event: EventOwnerCtx): void {
  if (!canManageEvent(me, event)) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to manage this calendar event');
  }
}

/** Minimal slot ownership shape (populated from the class group relations). */
export interface SlotOwnerCtx {
  classGroup: {
    coordinatorUserId?: string | null;
    program: { coordinatorUserId?: string | null };
  };
}

/**
 * May `me` manage a timetable slot?
 * - REGISTRAR_ADMIN: always.
 * - CLASS_COORDINATOR: only slots of the class they coordinate.
 * - PROGRAM_COORDINATOR: only slots of a class in the program they coordinate.
 * - HOD: class slots within their school dept (requires a department attachment).
 */
export function canManageSlot(me: ManagerContext, slot: SlotOwnerCtx): boolean {
  if (!hasPermission(me.role, me.position, 'timetable.manage')) return false;
  if (me.role === 'REGISTRAR_ADMIN') return true;
  if (me.position === 'CLASS_COORDINATOR') {
    return slot.classGroup.coordinatorUserId === me.id;
  }
  if (me.position === 'PROGRAM_COORDINATOR') {
    return slot.classGroup.program.coordinatorUserId === me.id;
  }
  if (me.position === 'HOD') {
    return Boolean(me.departmentId);
  }
  return false;
}

/** Guard version of {@link canManageSlot} (throws 403). */
export function requireManageSlot(me: ManagerContext, slot: SlotOwnerCtx): void {
  if (!canManageSlot(me, slot)) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to manage this timetable slot');
  }
}
