// ==============================================================================
// Backlog & Revaluation module (Batch C) — backend business logic.
// Pure functions (backlog derivation, revaluation transitions) live here so the
// tester can unit-test them without a database. Thin tenant/permission helpers
// are re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/backlog.md §6):
//   - A backlog is derived from a failing (F) grade in a published result.
//   - Revaluation may be requested only ONCE per backlog; a second request
//     returns 409 REVALUATION_ALREADY_REQUESTED.
//   - Revaluation status transition: REQUESTED → APPROVED → COMPLETED, or
//     REQUESTED → REJECTED (canTransitionRevaluation).
//   - Supplementary registration requires an existing backlog for that course
//     (else 400 NO_BACKLOG_FOR_COURSE); passing the supplementary exam flips the
//     backlog status to CLEARED.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const BACKLOG_DERIVATION_GRADE = 'F';

export const BACKLOG_STATUS = {
    BACKLOG: 'BACKLOG',
    CLEARED: 'CLEARED',
} as const;

export const REVALUATION_STATUS = {
    REQUESTED: 'REQUESTED',
    APPROVED: 'APPROVED',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
} as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Derives whether a grade produces a backlog. Per the frozen spec, only a
 * failing grade (F) yields a backlog. Case-insensitive.
 */
export function deriveBacklogFromF(grade: string): boolean {
    return (grade || '').trim().toUpperCase() === BACKLOG_DERIVATION_GRADE;
}

/**
 * Validates a revaluation status transition. Only the following edges are legal:
 *   REQUESTED → APPROVED | REJECTED
 *   APPROVED  → COMPLETED
 * Any other pair returns false.
 */
export function canTransitionRevaluation(from: string, to: string): boolean {
    if (from === REVALUATION_STATUS.REQUESTED) {
        return to === REVALUATION_STATUS.APPROVED || to === REVALUATION_STATUS.REJECTED;
    }
    if (from === REVALUATION_STATUS.APPROVED) {
        return to === REVALUATION_STATUS.COMPLETED;
    }
    return false;
}

// ---- Tenant filter (mirrors hostel-core) --------------------------------------

/**
 * Builds a tenant filter for queries run by central ('ALL') officers.
 * School-scoped users never pass this — the extended Prisma client injects
 * their schoolId automatically. Central officers must include the target
 * schoolId explicitly or the query would span every school.
 */
export function tenantFilter(
    isCentral: boolean,
    schoolId: string | undefined
): Record<string, unknown> {
    if (!isCentral || !schoolId) return {};
    return { schoolId };
}

// ---- Permission gates (server-side) -------------------------------------------

/**
 * Resolves a user's effective permissions (handles SUPER_ADMIN bypass, custom
 * role replacement, and the static matrix) and checks membership of a catalog
 * permission. Used to gate admin vs read-only vs self-service actions.
 */
export async function userHasPermission(
    user: { role: string; position?: string | null; customRoleId?: string | null },
    permission: string
): Promise<boolean> {
    const effective = await resolveUserEffectivePermissions(user);
    return effective.includes(permission as import('./perms').Permission);
}

/** Backlog admin (approve/reject revaluation, schedule exams) requires `backlog.manage`. */
export function requireBacklogManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Backlog management permission required');
}

/** Read-only view of backlog admin data requires `backlog.view` OR `backlog.manage`. */
export function requireBacklogView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Backlog view permission required');
}
