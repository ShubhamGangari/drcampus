// ==============================================================================
// Academic Governance & Organizational Structure — pure business logic.
// All functions here are deterministic and free of I/O so the tester can unit
// test them directly (see src/lib/__tests__/org.test.ts).
// ==============================================================================

import { hasPermission, LEGAL_POSITIONS, Permission, UserRole } from './perms';
import { ApiError } from './errors';
import type { Db } from './prisma';

/**
 * Is `position` legal for a user whose base role is `role`?
 * - null/undefined position is always legal (clears the position → role default).
 * - An unknown role is never legal.
 */
export function isLegalPosition(role: string | null | undefined, position: string | null | undefined): boolean {
  if (position == null) return true;
  if (!role || !(role in LEGAL_POSITIONS)) return false;
  const legal = LEGAL_POSITIONS[role as UserRole];
  return legal.includes(position as (typeof legal)[number]);
}

/** Throws ApiError(400, INVALID_POSITION) when the position is not legal. */
export function assertLegalPosition(role: string | null | undefined, position: string | null | undefined): void {
  if (!isLegalPosition(role, position)) {
    throw new ApiError(
      400,
      'INVALID_POSITION',
      `Position "${String(position)}" is not valid for this user's role`
    );
  }
}

/** Guard: require `permission` for the acting user (role × position). */
export function requirePermission(
  me: { role?: string | null; position?: string | null },
  permission: Permission
): void {
  if (!hasPermission(me.role, me.position, permission)) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
  }
}

/**
 * Resolve the acting user (role/position/department) for permission gates.
 * Relies on the caller having set up the correct DB client (central vs scoped).
 */
export async function getActingUser(db: Db, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, schoolId: true, position: true, departmentId: true },
  });
}

/** Canonical uniqueness key for a course–faculty allocation. */
export function allocationKey(
  courseId: string,
  classGroupId: string,
  semester: number,
  academicYear: string
): string {
  return [courseId, classGroupId, String(semester), academicYear].join('|');
}

/** Semester must be a positive integer (sanity check before any allocation). */
export function isSemesterValid(semester: number): boolean {
  return Number.isInteger(semester) && semester >= 1;
}
