// ==============================================================================
// Internships module (Batch D) — backend business logic.
// Pure functions (status transition validation) live here so the tester can
// unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/internships.md §6):
//   - Status transitions are validated by canTransitionInternshipStatus
//     (APPLIED→APPROVED→ONGOING→COMPLETED; any →REJECTED).
//   - Marking COMPLETED requires a certificateNo (else 400).
//   - Only `internship.manage` may approve/complete; students may only
//     apply/review their own.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const INTERNSHIP_STATUS = {
    APPLIED: 'APPLIED',
    APPROVED: 'APPROVED',
    ONGOING: 'ONGOING',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
} as const;

export type InternshipStatus = (typeof INTERNSHIP_STATUS)[keyof typeof INTERNSHIP_STATUS];

export const VALID_INTERNSHIP_STATUSES: readonly InternshipStatus[] = [
    'APPLIED',
    'APPROVED',
    'ONGOING',
    'COMPLETED',
    'REJECTED',
];

export function isInternshipStatus(value: string): value is InternshipStatus {
    return (VALID_INTERNSHIP_STATUSES as readonly string[]).includes(value);
}

// Valid forward flow (one step at a time). REJECTED is reachable from any state.
const INTERNSHIP_FLOW: readonly InternshipStatus[] = ['APPLIED', 'APPROVED', 'ONGOING', 'COMPLETED'];

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Validates an internship status transition. Allowed:
 *   - forward one step in the flow (APPLIED→APPROVED→ONGOING→COMPLETED);
 *   - any state → REJECTED.
 * Anything else (including same-state and backwards moves) is blocked.
 */
export function canTransitionInternshipStatus(from: string, to: string): boolean {
    if (!isInternshipStatus(from) || !isInternshipStatus(to)) return false;
    if (to === INTERNSHIP_STATUS.REJECTED) return true;
    const fi = INTERNSHIP_FLOW.indexOf(from);
    const ti = INTERNSHIP_FLOW.indexOf(to);
    return fi !== -1 && ti === fi + 1;
}

// ---- Tenant filter (mirrors registration-core) --------------------------------

/**
 * Builds a tenant filter for queries run by central ('ALL') officers.
 * School-scoped users never pass this — the extended Prisma client injects
 * their schoolId automatically.
 */
export function tenantFilter(
    isCentral: boolean,
    schoolId: string | undefined
): Record<string, unknown> {
    if (!isCentral || !schoolId) return {};
    return { schoolId };
}

// ---- Permission gates (server-side) -------------------------------------------

/** Resolves a user's effective permissions and checks membership of a catalog permission. */
export async function userHasPermission(
    user: { role: string; position?: string | null; customRoleId?: string | null },
    permission: string
): Promise<boolean> {
    const effective = await resolveUserEffectivePermissions(user);
    return effective.includes(permission as import('./perms').Permission);
}

/** Internship management (listings/approvals/completion) requires `internship.manage`. */
export function requireInternshipManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Internship management permission required');
}

/** Read-only view of internship records requires `internship.view` OR `internship.manage`. */
export function requireInternshipView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Internship view permission required');
}
