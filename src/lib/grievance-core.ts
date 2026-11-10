// ==============================================================================
// Grievance & Helpdesk module (Batch B) — backend business logic.
// Pure functions (ticket number builder, status state machine) live here so the
// tester can unit-test them without a database. Thin tenant/permission helpers
// are re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/grievance.md §6):
//   - buildTicketNo(schoolCode, seq) -> "GRV-2026-0001"
//   - Transitions: OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED,
//     and OPEN/IN_PROGRESS→CLOSED only by admin.
//   - Resolution requires a non-empty note before marking RESOLVED.
//   - Setting URGENT requires grievance.manage.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const GRIEVANCE_CATEGORIES = [
    'ACADEMIC',
    'HOSTEL',
    'FEES',
    'TRANSPORT',
    'GENERAL',
] as const;
export const GRIEVANCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const GRIEVANCE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Ticket number builder: `GRV-{year}-{4-digit seq}`. The year defaults to the
 * current calendar year; the seq is zero-padded to 4 digits.
 */
export function buildTicketNo(
    schoolCode: string,
    seq: number,
    year: string | number = new Date().getFullYear()
): string {
    const n = String(Math.max(1, Math.floor(Number(seq) || 1))).padStart(4, '0');
    return `GRV-${year}-${n}`;
}

/**
 * Allowed status transitions for a grievance ticket (pure state machine).
 * - OPEN → IN_PROGRESS
 * - IN_PROGRESS → RESOLVED
 * - RESOLVED → CLOSED
 * - OPEN/IN_PROGRESS → CLOSED (admin-only; this function allows it and the route
 *   gates the transition on grievance.manage).
 */
export function canTransitionStatus(from: string, to: string): boolean {
    if (from === 'OPEN' && to === 'IN_PROGRESS') return true;
    if (from === 'OPEN' && to === 'CLOSED') return true;
    if (from === 'IN_PROGRESS' && to === 'RESOLVED') return true;
    if (from === 'IN_PROGRESS' && to === 'CLOSED') return true;
    if (from === 'RESOLVED' && to === 'CLOSED') return true;
    return false;
}

// ---- Tenant filter (mirrors library-core) ------------------------------------

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

/**
 * Helpdesk management (triage, assign, respond, resolve, escalate) requires
 * `grievance.manage` (or SUPER_ADMIN / REGISTRAR_ADMIN via the static matrix).
 */
export function requireGrievanceManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Grievance management permission required');
}

/**
 * Read-only ticket view requires `grievance.view` OR `grievance.manage`.
 * Students still get self-service on their own tickets — handled by the routes.
 */
export function requireGrievanceView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Grievance view permission required');
}
