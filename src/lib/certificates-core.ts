// ==============================================================================
// Certificates & Documents module (Batch A) — backend business logic.
// Pure functions (request/reference number builders, status transition rules,
// type eligibility) live here so the tester can unit-test them without a
// database. Thin tenant/permission helpers are re-exported or defined here for
// use by the API routes.
//
// FROZEN rules (docs/specs/certificates.md §6):
//   - requestNo = `REQ-<year>-<seq>`; referenceNo generated on issue =
//     `CERT-<year>-<seq>`.
//   - Only ISSUED certificates can be downloaded / verified.
//   - A rejected request can be re-requested (new record).
//   - Bonafide requires an active student record; TC/Migration require a
//     graduated/withdrawn student.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership/sequence helpers (one source of truth).
export {
    resolveCreateTenant,
    assertStudentBelongsToSchool,
    findSelfStudent,
    computeNextSeq,
    getNextSequence,
} from './fee-core';

// ---- Constants ---------------------------------------------------------------

export const CERTIFICATE_TYPES = {
    TC: 'TC',
    MIGRATION: 'MIGRATION',
    CHARACTER: 'CHARACTER',
    BONAFIDE: 'BONAFIDE',
    PROVISIONAL_DEGREE: 'PROVISIONAL_DEGREE',
} as const;

export const CERTIFICATE_STATUSES = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    ISSUED: 'ISSUED',
} as const;

/** Types that require an active student record (e.g. Bonafide). */
export const ACTIVE_STUDENT_TYPES = [CERTIFICATE_TYPES.BONAFIDE] as const;

/** Types that require a graduated/withdrawn student (TC, Migration). */
export const GRADUATED_STUDENT_TYPES = [
    CERTIFICATE_TYPES.TC,
    CERTIFICATE_TYPES.MIGRATION,
] as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Request number builder: `REQ-{year}-{6-digit seq}`.
 */
export function buildRequestNo(seq: number, year: string | number): string {
    const n = String(Math.max(1, Math.floor(Number(seq) || 1))).padStart(6, '0');
    return `REQ-${year}-${n}`;
}

/**
 * Reference number builder (assigned on issue): `CERT-{year}-{6-digit seq}`.
 */
export function buildReferenceNo(seq: number, year: string | number): string {
    const n = String(Math.max(1, Math.floor(Number(seq) || 1))).padStart(6, '0');
    return `CERT-${year}-${n}`;
}

/**
 * True when moving from `from` to `to` is an allowed status transition.
 *   PENDING  -> APPROVED | REJECTED
 *   APPROVED -> ISSUED | REJECTED
 *   REJECTED / ISSUED are terminal (no outgoing transitions).
 */
export function canTransitionStatus(from: string, to: string): boolean {
    if (from === to) return false;
    switch (from) {
        case CERTIFICATE_STATUSES.PENDING:
            return (
                to === CERTIFICATE_STATUSES.APPROVED ||
                to === CERTIFICATE_STATUSES.REJECTED
            );
        case CERTIFICATE_STATUSES.APPROVED:
            return (
                to === CERTIFICATE_STATUSES.ISSUED ||
                to === CERTIFICATE_STATUSES.REJECTED
            );
        default:
            return false;
    }
}

/** True when a type may only be requested by an active student (e.g. Bonafide). */
export function requiresActiveStudent(type: string): boolean {
    return (ACTIVE_STUDENT_TYPES as readonly string[]).includes(type);
}

/** True when a type requires a graduated/withdrawn student (TC, Migration). */
export function requiresGraduatedStudent(type: string): boolean {
    return (GRADUATED_STUDENT_TYPES as readonly string[]).includes(type);
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

/** Certificate management (approve/reject/issue) requires `certificates.manage`. */
export function requireCertificatesManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Certificates management permission required');
}

/** Read-only view requires `certificates.view` OR `certificates.manage`. */
export function requireCertificatesView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Certificates view permission required');
}
