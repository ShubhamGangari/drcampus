// ==============================================================================
// Library Management module (Batch A) — backend business logic.
// Pure functions (fine computation, overdue day math, loan status) live here so
// the tester can unit-test them without a database. Thin tenant/permission
// helpers are re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/library.md §6):
//   - Default loan period = 14 days.
//   - Late fine = ₹5 per day overdue, capped at ₹500 flat.
//   - daysOverdue = max(0, floor((today - dueDate)/86400000)); only applies when
//     status is ISSUED/OVERDUE.
//   - A copy is available=false while it has an active (non-RETURNED) loan.
//   - A user must have an active membership to be issued a book (auto-create
//     membership type STUDENT on first issue).
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Constants ----------------------------------------------------------------

export const LIBRARY_DEFAULT_LOAN_DAYS = 14;
export const LIBRARY_FINE_PER_DAY = 5;
export const LIBRARY_FINE_CAP = 500;

export const LOAN_STATUS = {
    ISSUED: 'ISSUED',
    OVERDUE: 'OVERDUE',
    RETURNED: 'RETURNED',
} as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Number of days a loan is overdue. `max(0, floor((today - dueDate)/86400000))`.
 * Non-positive values (due today or in the future) yield 0.
 */
export function daysOverdue(today: Date, dueDate: Date): number {
    const diff = today.getTime() - dueDate.getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / 86400000);
}

/**
 * Late fine for a loan, ₹5 per day overdue capped at ₹500 flat.
 * Pure function — the tester unit-tests this directly.
 * - computeFine(0) === 0
 * - computeFine(3) === 15
 * - cap respected: computeFine(999) === 500
 */
export function computeFine(daysOverdue: number): number {
    const days = Math.max(0, Math.floor(Number(daysOverdue) || 0));
    if (days === 0) return 0;
    return Math.min(days * LIBRARY_FINE_PER_DAY, LIBRARY_FINE_CAP);
}

export interface LoanStateInput {
    dueDate: Date;
    returnDate?: Date | null;
}

/**
 * Derives a loan's effective status from its due date and whether it has been
 * returned. A returned loan is always RETURNED; otherwise overdue-past-due is
 * OVERDUE and everything else is ISSUED.
 */
export function computeLoanStatus(loan: LoanStateInput, today: Date = new Date()): string {
    if (loan.returnDate) return LOAN_STATUS.RETURNED;
    return daysOverdue(today, loan.dueDate) > 0 ? LOAN_STATUS.OVERDUE : LOAN_STATUS.ISSUED;
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

/**
 * Library management (catalogue writes, issue/return, membership admin, fines
 * payment) requires `library.manage` (or SUPER_ADMIN / REGISTRAR_ADMIN via the
 * static matrix).
 */
export function requireLibraryManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Library management permission required');
}

/**
 * Read-only catalogue/circulation view requires `library.view` OR
 * `library.manage`. Students/faculty still get self-service (their own loans
 * and fines) without these permissions — handled by the routes.
 */
export function requireLibraryView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Library view permission required');
}
