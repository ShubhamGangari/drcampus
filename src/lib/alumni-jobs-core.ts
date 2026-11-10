// ==============================================================================
// Alumni Jobs Board module (Batch D) — backend business logic.
// Pure functions (status transition validation) live here so the tester can
// unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/alumni-jobs.md §6):
//   - Status transitions are validated by canTransitionJobStatus
//     (PENDING→APPROVED/REJECTED; APPROVED→REJECTED; REJECTED→APPROVED).
//   - New posts default to PENDING; only APPROVED jobs are visible publicly.
//   - Posting requires `alumniJobs.post` OR an alumni profile OR admin.
//   - Only `alumniJobs.manage` may moderate (approve/reject/remove).
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';
import type { AuthPayload } from './auth';
import type { Db } from './prisma';

// Re-export shared tenant/ownership helpers (one source of truth).
import { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent };

// ---- Constants ----------------------------------------------------------------

export const JOB_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const VALID_JOB_STATUSES: readonly JobStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export function isJobStatus(value: string): value is JobStatus {
    return (VALID_JOB_STATUSES as readonly string[]).includes(value);
}

export const JOB_TYPES = {
    FULL_TIME: 'FULL_TIME',
    PART_TIME: 'PART_TIME',
    CONTRACT: 'CONTRACT',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export const VALID_JOB_TYPES: readonly JobType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT'];

export function isJobType(value: string): value is JobType {
    return (VALID_JOB_TYPES as readonly string[]).includes(value);
}

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Validates a job status transition. Allowed:
 *   - PENDING → APPROVED / REJECTED;
 *   - APPROVED → REJECTED;
 *   - REJECTED → APPROVED.
 * Anything else (including same-state moves) is blocked.
 */
export function canTransitionJobStatus(from: string, to: string): boolean {
    if (!isJobStatus(from) || !isJobStatus(to)) return false;
    if (from === JOB_STATUS.PENDING) {
        return to === JOB_STATUS.APPROVED || to === JOB_STATUS.REJECTED;
    }
    if (from === JOB_STATUS.APPROVED) {
        return to === JOB_STATUS.REJECTED;
    }
    if (from === JOB_STATUS.REJECTED) {
        return to === JOB_STATUS.APPROVED;
    }
    return false;
}

// ---- Tenant filter (mirrors placement-core) -----------------------------------

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

/** Moderation of the alumni jobs board requires `alumniJobs.manage`. */
export function requireAlumniJobsManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Alumni jobs moderation permission required');
}

/** Posting a job requires `alumniJobs.post` OR an alumni profile OR admin. */
export function requireAlumniJobsPost(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Posting permission required');
}

/** Applying to a job is restricted to students. */
export function requireStudentApplication(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Only students may apply to alumni jobs');
}

/**
 * Resolves the logged-in user's Alumni profile, if one exists. Links via the
 * self-student record (same email as the User account). Returns null otherwise.
 */
export async function findSelfAlumnus(db: Db, user: AuthPayload) {
    const self = await findSelfStudent(db, user);
    if (!self) return null;
    return db.alumni.findFirst({ where: { studentId: self.id } });
}
