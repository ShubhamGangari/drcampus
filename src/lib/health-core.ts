// ==============================================================================
// Health & Medical Centre module (Batch B) — backend business logic.
// Pure functions (visit payload validation) live here so the tester can
// unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/health.md §6):
//   - status=FOLLOW_UP_REQUIRED requires followUpDate set (validation).
//   - A student health record is auto-created (empty) on first profile read.
//   - Only the owning student or health.view/health.manage can read a record.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const HEALTH_VISIT_TYPES = ['OPD', 'FOLLOW_UP'] as const;
export const HEALTH_VISIT_STATUSES = ['SCHEDULED', 'COMPLETED', 'FOLLOW_UP_REQUIRED'] as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

export interface VisitPayload {
    status?: string;
    followUpDate?: Date | string | null;
}

/**
 * Validates a health-visit payload. A visit whose status is
 * `FOLLOW_UP_REQUIRED` must carry a `followUpDate`. Returns
 * `{ valid: true }` or `{ valid: false, error }`.
 */
export function validateVisitPayload(payload: VisitPayload): { valid: boolean; error?: string } {
    if (
        payload.status === 'FOLLOW_UP_REQUIRED' &&
        (payload.followUpDate === null || payload.followUpDate === undefined || payload.followUpDate === '')
    ) {
        return {
            valid: false,
            error: 'followUpDate is required when status is FOLLOW_UP_REQUIRED',
        };
    }
    return { valid: true };
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

export function requireHealthManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Health management permission required');
}

export function requireHealthView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Health view permission required');
}
