// ==============================================================================
// Grade Cards & Transcripts module (Batch C) — backend business logic.
// Pure functions (grade-to-points, SGPA, CGPA) live here so the tester can
// unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/gradecard.md §6):
//   - Grade points: A+=10, A=9, B+=8, B=7, C+=6, C=5, D=4, F=0.
//   - SGPA = Σ(gradePoints × credits) / Σcredits across a semester.
//   - CGPA = mean of semester SGPAs (aggregates semesters).
//   - A transcript may only be issued for a student with at least one published
//     result (else 400 NO_PUBLISHED_RESULT).
//   - Transcript verification returns only public fields — no email/phone/DOB.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const GRADE_POINTS: Record<string, number> = {
    'A+': 10,
    A: 9,
    'B+': 8,
    B: 7,
    'C+': 6,
    C: 5,
    D: 4,
    F: 0,
};

export const TRANSCRIPT_TYPES = {
    SEMESTER: 'SEMESTER',
    FULL: 'FULL',
} as const;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Maps a letter grade to its numeric grade point (A+=10 … F=0). Unknown grades
 * map to 0 (treated like an F for aggregation safety).
 */
export function gradeToPoints(grade: string): number {
    return GRADE_POINTS[(grade || '').trim().toUpperCase()] ?? 0;
}

export interface GradeEntry {
    credits: number;
    grade: string;
}

/**
 * Computes a semester SGPA as the credit-weighted mean of grade points.
 * `Σ(gradePoints × credits) / Σcredits`. Returns 0 for an empty or zero-credit
 * semester. Rounded to 2 decimal places.
 */
export function computeSGPA(entries: GradeEntry[]): number {
    let totalCredits = 0;
    let weighted = 0;
    for (const entry of entries) {
        const credits = Math.max(0, Number(entry.credits) || 0);
        totalCredits += credits;
        weighted += credits * gradeToPoints(entry.grade);
    }
    if (totalCredits === 0) return 0;
    return round2(weighted / totalCredits);
}

export interface SemesterSummary {
    sgpa: number;
}

/**
 * Computes the cumulative CGPA as the unweighted mean of semester SGPAs.
 * Semesters with non-finite SGPAs are skipped; 0 with no valid semesters.
 */
export function computeCGPA(semesters: SemesterSummary[]): number {
    const valid = (semesters || []).filter(
        (s) => s && Number.isFinite(Number(s.sgpa))
    );
    if (valid.length === 0) return 0;
    const total = valid.reduce((sum, s) => sum + Number(s.sgpa), 0);
    return round2(total / valid.length);
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

/** Transcript issuance admin requires `gradecard.manage`. */
export function requireGradecardManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Grade card management permission required');
}

/** Read-only view of transcripts/results requires `gradecard.view` OR `gradecard.manage`. */
export function requireGradecardView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Grade card view permission required');
}
