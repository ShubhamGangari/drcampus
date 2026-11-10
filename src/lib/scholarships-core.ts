// ==============================================================================
// Scholarships & Concessions module (Batch B) — backend business logic.
// Pure functions (eligibility evaluation, award computation) live here so the
// tester can unit-test them without a database. Thin tenant/permission helpers
// are re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/scholarships.md §6):
//   - evaluateEligibility(applicant, scheme) -> { eligible, reason? }
//   - computeAward(scheme, tuitionFee) -> amount (PERCENT schemes are rounded
//     percent of tuition fee; AMOUNT schemes return the flat value).
//   - At most one active application per student/scheme/academic-year.
//   - Rejection requires a remark.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const SCHOLARSHIP_TYPES = ['MERIT', 'NEED_BASED', 'CATEGORY', 'SPORTS'] as const;
export const SCHOLARSHIP_VALUE_KINDS = ['AMOUNT', 'PERCENT'] as const;
export const SCHOLARSHIP_APP_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED'] as const;

export interface ScholarshipCriteria {
    minPercentage?: number;
    category?: string;
    sports?: boolean;
    academicYear?: string;
}

export interface ScholarshipApplicantProfile {
    aggregatePercentage?: number;
    category?: string;
    sports?: boolean;
}

/**
 * Parses a scheme's `criteriaJson` string into a typed object. Never throws:
 * malformed/empty JSON degrades to an empty criteria set.
 */
export function parseCriteria(criteriaJson: string | null | undefined): ScholarshipCriteria {
    if (!criteriaJson) return {};
    try {
        const parsed: unknown = JSON.parse(criteriaJson);
        return (parsed && typeof parsed === 'object' ? parsed : {}) as ScholarshipCriteria;
    } catch {
        return {};
    }
}

/**
 * Auto-evaluates whether an applicant meets a scheme's eligibility criteria.
 * - MERIT     : criteria.minPercentage is required and applicant.aggregatePercentage
 *               must meet or exceed it.
 * - CATEGORY  : applicant.category must match criteria.category.
 * - SPORTS    : applicant.sports must be true.
 * - NEED_BASED / others : eligible by default (no hard rule).
 * Returns `{ eligible: true }` or `{ eligible: false, reason }`.
 */
export function evaluateEligibility(
    applicant: ScholarshipApplicantProfile,
    scheme: { type: string; criteriaJson?: string | null }
): { eligible: boolean; reason?: string } {
    const criteria = parseCriteria(scheme.criteriaJson);

    if (scheme.type === 'MERIT') {
        const min = Number(criteria.minPercentage);
        const agg = Number(applicant.aggregatePercentage);
        if (
            Number.isFinite(min) &&
            (!Number.isFinite(agg) || agg < min)
        ) {
            return { eligible: false, reason: `Requires ${min}% aggregate` };
        }
    }

    if (scheme.type === 'CATEGORY') {
        if (criteria.category && applicant.category !== criteria.category) {
            return { eligible: false, reason: `Category must be ${criteria.category}` };
        }
    }

    if (scheme.type === 'SPORTS') {
        if (!applicant.sports) {
            return { eligible: false, reason: 'Sports participation required' };
        }
    }

    return { eligible: true };
}

const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Computes the awarded amount for a scheme.
 * - AMOUNT : returns the scheme value itself (in ₹).
 * - PERCENT : returns round(value% * tuitionFee) — value is a percentage.
 * Both are rounded to 2 decimal places.
 */
export function computeAward(
    scheme: { value: number; valueKind?: string },
    tuitionFee: number
): number {
    const value = Number(scheme.value) || 0;
    if (scheme.valueKind === 'PERCENT') {
        const fee = Number(tuitionFee) || 0;
        return roundMoney(fee * (value / 100));
    }
    return roundMoney(value);
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

export function requireScholarshipsManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Scholarships management permission required');
}

export function requireScholarshipsView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Scholarships view permission required');
}
