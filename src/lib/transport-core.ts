// ==============================================================================
// Transport Management module (Batch A) — backend business logic.
// Pure functions (pass expiry/status math) live here so the tester can unit-test
// them without a database. Thin tenant/permission helpers are re-exported or
// defined here for use by the API routes.
//
// FROZEN rules (docs/specs/transport.md §6):
//   - A pass is ACTIVE only between validFrom and validTo; after validTo it is
//     EXPIRED (recompute on read).
//   - A vehicle can be assigned to at most one route at a time.
//   - status = MAINTENANCE vehicles are not assignable to active routes.
//   - Issuing a new pass for a student with an ACTIVE pass → 409 (renew instead).
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';
import { Db } from './prisma';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ---------------------------------------------------------------

export const PASS_STATUS = {
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    PENDING: 'PENDING',
} as const;

export const VEHICLE_STATUS = {
    ACTIVE: 'ACTIVE',
    MAINTENANCE: 'MAINTENANCE',
} as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * True when `when` is strictly after `validTo`. A pass expiring exactly now is
 * still considered valid until the end of that instant.
 */
export function isPassExpired(validTo: Date, when: Date = new Date()): boolean {
    return when.getTime() > validTo.getTime();
}

/**
 * Derives the effective status of a pass. A stored PENDING status is preserved;
 * otherwise the pass is ACTIVE until validTo passes, after which it is EXPIRED.
 * This is the "recompute on read" rule from the spec.
 */
export function computePassStatus(
    storedStatus: string,
    validTo: Date,
    when: Date = new Date()
): string {
    if (storedStatus === PASS_STATUS.PENDING) return PASS_STATUS.PENDING;
    return isPassExpired(validTo, when) ? PASS_STATUS.EXPIRED : PASS_STATUS.ACTIVE;
}

/**
 * A vehicle in MAINTENANCE cannot be assigned to a route. Pure check — the
 * route asserts this before assigning/maintaining a vehicle's routeId.
 */
export function canAssignVehicle(status: string): boolean {
    return status !== VEHICLE_STATUS.MAINTENANCE;
}

// ---- Parse helpers for stored JSON -------------------------------------------

export interface RouteStop {
    name: string;
    order: number;
    time?: string | null;
}

/** Parses a route's `stopsJson` column into an ordered array of stops. */
export function parseStops(raw: string | null | undefined): RouteStop[] {
    if (!raw) return [];
    try {
        const value = JSON.parse(raw) as unknown;
        if (!Array.isArray(value)) return [];
        return value as RouteStop[];
    } catch {
        return [];
    }
}

/** A pass is ACTIVE only between validFrom and validTo; after validTo EXPIRED. */
export function computePassValidity(
    pass: {
        validFrom: Date;
        validTo: Date;
        status: string;
    },
    when: Date = new Date()
): string {
    if (when.getTime() < pass.validFrom.getTime()) return PASS_STATUS.PENDING;
    return computePassStatus(pass.status, pass.validTo, when);
}

// ---- Tenant filter (mirrors library-core) ------------------------------------

/**
 * Builds a tenant filter for queries run by central ('ALL') officers. School-
 * scoped users never pass this — the extended Prisma client injects their
 * schoolId automatically.
 */
export function tenantFilter(
    isCentral: boolean,
    schoolId: string | undefined
): Record<string, unknown> {
    if (!isCentral || !schoolId) return {};
    return { schoolId };
}

// ---- Permission gates (server-side) ------------------------------------------

/**
 * Resolves a user's effective permissions (handles SUPER_ADMIN bypass, custom
 * role replacement, and the static matrix) and checks membership of a catalog
 * permission.
 */
export async function userHasPermission(
    user: { role: string; position?: string | null; customRoleId?: string | null },
    permission: string
): Promise<boolean> {
    const effective = await resolveUserEffectivePermissions(user);
    return effective.includes(permission as import('./perms').Permission);
}

/** Transport management requires `transport.manage`. */
export function requireTransportManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
}

/** Read-only view requires `transport.view` OR `transport.manage`. */
export function requireTransportView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Transport view permission required');
}

// ---- DB helpers --------------------------------------------------------------

/**
 * Loads a route and asserts it belongs to `schoolId` (404 / 400). Returns the
 * route row.
 */
export async function assertRouteBelongsToSchool(
    db: Db,
    routeId: string,
    schoolId: string
) {
    const route = await db.transportRoute.findUnique({
        where: { id: routeId },
        select: { id: true, schoolId: true, active: true },
    });
    if (!route) {
        throw new ApiError(404, 'NOT_FOUND', 'Route not found');
    }
    if (route.schoolId !== schoolId) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Route does not belong to this school');
    }
    return route;
}
