// ==============================================================================
// Course & Semester Registration module (Batch C) — backend business logic.
// Pure functions (window check, credit-cap validation) live here so the tester
// can unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/registration.md §6):
//   - Registration requires an OPEN window: window.active must be true AND now
//     must fall within [opensAt, closesAt] (else 400 WINDOW_CLOSED).
//   - Credit cap = 24 credits per student per semester (validateCreditCap).
//   - Elective seats are capped by course.seatsTotal; a full elective returns
//     409 SEAT_LIMIT_EXCEEDED.
//   - A student may register a course only once per (semester, academicYear);
//     duplicates return 409 DUPLICATE_REGISTRATION.
//   - Dropping a course sets its registration status to DROPPED and frees its
//     elective seat.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const REGISTRATION_MAX_CREDITS = 24;
export const REGISTRATION_ELECTIVE_TYPE = 'ELECTIVE';

export const REGISTRATION_STATUS = {
    REGISTERED: 'REGISTERED',
    DROPPED: 'DROPPED',
} as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

export interface RegistrationWindowLike {
    active: boolean;
    opensAt: Date | string;
    closesAt: Date | string;
}

/**
 * True when a registration window is currently open: it is flagged `active`
 * AND `now` falls within [opensAt, closesAt] (inclusive). A missing/closed
 * window, or a now before opensAt or after closesAt, returns false.
 */
export function isWindowOpen(window: RegistrationWindowLike, now: Date = new Date()): boolean {
    if (!window || !window.active) return false;
    const opens = new Date(window.opensAt).getTime();
    const closes = new Date(window.closesAt).getTime();
    const t = now.getTime();
    return t >= opens && t <= closes;
}

/**
 * Validates the credit-cap rule. A registration is allowed when the running
 * total (current enrolled credits) plus the credits being added does not exceed
 * the cap (default 24). Non-numeric inputs are treated as 0.
 */
export function validateCreditCap(
    currentCredits: number,
    addedCredits: number,
    cap: number = REGISTRATION_MAX_CREDITS
): boolean {
    const current = Math.max(0, Number(currentCredits) || 0);
    const added = Math.max(0, Number(addedCredits) || 0);
    return current + added <= cap;
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

/** Registration admin (window creation, view all registrations) requires `registration.manage`. */
export function requireRegistrationManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Registration management permission required');
}

/** Read-only view of all registrations requires `registration.view` OR `registration.manage`. */
export function requireRegistrationView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Registration view permission required');
}
