// ==============================================================================
// Placement Cell module (Batch D) — backend business logic.
// Pure functions (status transition validation) live here so the tester can
// unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/placement.md §6):
//   - Status transitions are validated by canTransitionPlacementStatus
//     (APPLIED→SHORTLISTED→OFFERED→PLACED; any →REJECTED).
//   - Only `placement.manage` may shortlist/offer/mark placed; students can
//     only create/review their own applications.
//   - Placement outcomes derive from PLACED applications (used by reports).
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const PLACEMENT_STATUS = {
    APPLIED: 'APPLIED',
    SHORTLISTED: 'SHORTLISTED',
    OFFERED: 'OFFERED',
    PLACED: 'PLACED',
    REJECTED: 'REJECTED',
} as const;

export type PlacementStatus = (typeof PLACEMENT_STATUS)[keyof typeof PLACEMENT_STATUS];

export const VALID_PLACEMENT_STATUSES: readonly PlacementStatus[] = [
    'APPLIED',
    'SHORTLISTED',
    'OFFERED',
    'PLACED',
    'REJECTED',
];

export function isPlacementStatus(value: string): value is PlacementStatus {
    return (VALID_PLACEMENT_STATUSES as readonly string[]).includes(value);
}

// Valid forward flow (one step at a time). REJECTED is reachable from any state.
const PLACEMENT_FLOW: readonly PlacementStatus[] = ['APPLIED', 'SHORTLISTED', 'OFFERED', 'PLACED'];

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Validates a placement-application status transition. Allowed:
 *   - forward one step in the flow (APPLIED→SHORTLISTED→OFFERED→PLACED);
 *   - any state → REJECTED.
 * Anything else (including same-state and backwards moves) is blocked.
 */
export function canTransitionPlacementStatus(from: string, to: string): boolean {
    if (!isPlacementStatus(from) || !isPlacementStatus(to)) return false;
    if (to === PLACEMENT_STATUS.REJECTED) return true;
    const fi = PLACEMENT_FLOW.indexOf(from);
    const ti = PLACEMENT_FLOW.indexOf(to);
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

/** Placement management (companies/posts/drives/offers) requires `placement.manage`. */
export function requirePlacementManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Placement management permission required');
}

/** Read-only view of placement outcomes requires `placement.view` OR `placement.manage`. */
export function requirePlacementView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Placement view permission required');
}
