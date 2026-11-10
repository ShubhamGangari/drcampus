// ==============================================================================
// Question Bank & Exam Duty module (Batch C) — backend business logic.
// Pure functions (question status transitions) live here so the tester can
// unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/questionbank.md §6):
//   - Question status transition: DRAFT → SUBMITTED → APPROVED | REJECTED
//     (canTransitionQuestionStatus).
//   - A faculty member may author/submit questions only for their own allocated
//     courses (FacultyAllocation), unless they hold `questionbank.manage`.
//   - Exam duty assignment must reference an existing exam and must not be
//     duplicated for the same (exam, faculty) — else 409 DUPLICATE_DUTY.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const QUESTION_STATUS = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;

export const QUESTION_TYPES = ['MCQ', 'SHORT', 'LONG', 'VIVA'] as const;

export const QUESTION_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

export const DUTY_DEFAULT_ROLE = 'INVIGILATOR';

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Validates a question status transition. Only the following edges are legal:
 *   DRAFT      → SUBMITTED
 *   SUBMITTED  → APPROVED | REJECTED
 * Any other pair returns false.
 */
export function canTransitionQuestionStatus(from: string, to: string): boolean {
    if (from === QUESTION_STATUS.DRAFT) {
        return to === QUESTION_STATUS.SUBMITTED;
    }
    if (from === QUESTION_STATUS.SUBMITTED) {
        return to === QUESTION_STATUS.APPROVED || to === QUESTION_STATUS.REJECTED;
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

/** Question bank admin (approve/reject, duty assignment) requires `questionbank.manage`. */
export function requireQuestionbankManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Question bank management permission required');
}

/** Read-only view of the question bank/duty requires `questionbank.view` OR `questionbank.manage`. */
export function requireQuestionbankView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Question bank view permission required');
}
