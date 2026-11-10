// ==============================================================================
// Mentorship & Career Networking module (Batch D) — backend business logic.
// Pure functions (pairing/request state rules) live here so the tester can
// unit-test them without a database. Thin tenant/permission helpers are
// re-exported or defined here for use by the API routes.
//
// FROZEN rules (docs/specs/mentorship.md §6):
//   - A mentor's `available` flag gates new requests (unavailable → 409).
//   - A student may not request the same mentor twice (@@unique → 409).
//   - A mentor ACCEPTs a request → creates an ACTIVE pairing; REJECT → REJECTED.
//   - Only `mentorship.manage` may force-create or end a pairing.
//   - Meetings can be logged only for an ACTIVE pairing (canLogMeeting).
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';
import type { AuthPayload } from './auth';
import type { Db } from './prisma';

// Re-export shared tenant/ownership helpers (one source of truth).
import { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent };

// Alumni lookup (student-linked) reused from the alumni-jobs module.
import { findSelfAlumnus } from './alumni-jobs-core';
export { findSelfAlumnus };

// ---- Constants ----------------------------------------------------------------

export const REQUEST_STATUS = {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
} as const;

export type MentorshipRequestStatus = (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

export const VALID_REQUEST_STATUSES: readonly MentorshipRequestStatus[] = ['PENDING', 'ACCEPTED', 'REJECTED'];

export function isMentorshipRequestStatus(value: string): value is MentorshipRequestStatus {
    return (VALID_REQUEST_STATUSES as readonly string[]).includes(value);
}

export const PAIRING_STATUS = {
    ACTIVE: 'ACTIVE',
    ENDED: 'ENDED',
} as const;

export type MentorshipPairingStatus = (typeof PAIRING_STATUS)[keyof typeof PAIRING_STATUS];

export const VALID_PAIRING_STATUSES: readonly MentorshipPairingStatus[] = ['ACTIVE', 'ENDED'];

export function isMentorshipPairingStatus(value: string): value is MentorshipPairingStatus {
    return (VALID_PAIRING_STATUSES as readonly string[]).includes(value);
}

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * A PENDING request may be ACCEPTED or REJECTED by its mentor; nothing else.
 * Same-state and arbitrary transitions are blocked.
 */
export function canApplyRequestAction(from: string, action: string): boolean {
    if (!isMentorshipRequestStatus(from)) return false;
    if (from !== REQUEST_STATUS.PENDING) return false;
    return action === 'ACCEPT' || action === 'REJECT';
}

/**
 * Meetings can only be logged against an ACTIVE pairing (spec §6).
 */
export function canLogMeeting(pairingStatus: string): boolean {
    return pairingStatus === PAIRING_STATUS.ACTIVE;
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

/** Full mentorship administration (pairings, approvals) requires `mentorship.manage`. */
export function requireMentorshipManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Mentorship management permission required');
}

/** Read-only mentorship data requires `mentorship.view` OR `mentorship.manage`. */
export function requireMentorshipView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Mentorship view permission required');
}

/** Joining the program requires `mentorship.join` (or admin). */
export function requireMentorshipJoin(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Mentorship join permission required');
}

/**
 * Resolves the logged-in user's MentorProfile, if one exists. Mentors are
 * identified by their user account, so a user with a profile is acting as a
 * mentor (can receive/respond to requests).
 */
export async function findSelfMentor(db: Db, user: AuthPayload) {
    return db.mentorProfile.findFirst({ where: { userId: user.userId } });
}

/** Maps student ids → full names, preserving only found students. */
export async function resolveStudentNames(db: Db, ids: string[]): Promise<Map<string, string>> {
    const uniq = Array.from(new Set(ids));
    if (!uniq.length) return new Map();
    const students = await db.student.findMany({
        where: { id: { in: uniq } },
        select: { id: true, firstName: true, lastName: true },
    });
    return new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));
}

/** Maps mentor-profile ids → names, preserving only found mentors. */
export async function resolveMentorNames(db: Db, ids: string[]): Promise<Map<string, string>> {
    const uniq = Array.from(new Set(ids));
    if (!uniq.length) return new Map();
    const mentors = await db.mentorProfile.findMany({
        where: { id: { in: uniq } },
        select: { id: true, name: true },
    });
    return new Map(mentors.map((m) => [m.id, m.name]));
}
