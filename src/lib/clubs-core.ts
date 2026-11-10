// ==============================================================================
// Clubs, Societies & Events module (Batch B) — backend business logic.
// Pure functions (event status state machine) live here so the tester can
// unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/clubs.md §6):
//   - JOIN adds a membership (idempotent; duplicate -> 409). LEAVE removes it.
//   - A coordinator is a member with role=COORDINATOR; assigning a coordinator
//     auto-joins them.
//   - Event status transitions: UPCOMING → COMPLETED | CANCELLED.
//   - Only the coordinator of a club or clubs.manage can edit club/events.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const CLUB_CATEGORIES = [
    'TECHNICAL',
    'CULTURAL',
    'SPORTS',
    'LITERARY',
    'SOCIAL',
    'OTHER',
] as const;
export const CLUB_EVENT_STATUSES = ['UPCOMING', 'COMPLETED', 'CANCELLED'] as const;
export const CLUB_MEMBERSHIP_ROLES = ['MEMBER', 'COORDINATOR'] as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Event status state machine (pure). Only UPCOMING → COMPLETED and
 * UPCOMING → CANCELLED are allowed.
 */
export function canTransitionEventStatus(from: string, to: string): boolean {
    return from === 'UPCOMING' && (to === 'COMPLETED' || to === 'CANCELLED');
}

// ---- Tenant filter (mirrors library-core) ------------------------------------

export function tenantFilter(
    isCentral: boolean,
    schoolId: string | undefined
): Record<string, unknown> {
    if (!isCentral || !schoolId) return {};
    return { schoolId };
}

// ---- Permission gates (server-side) -------------------------------------------

export async function userHasPermission(
    user: { role: string; position?: string | null; customRoleId?: string | null },
    permission: string
): Promise<boolean> {
    const effective = await resolveUserEffectivePermissions(user);
    return effective.includes(permission as import('./perms').Permission);
}

export function requireClubsManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Clubs management permission required');
}

export function requireClubsView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Clubs view permission required');
}
