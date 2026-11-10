// ==============================================================================
// Notices & Circulars module (Batch A) — backend business logic.
// Pure functions (visibility window, audience matching) live here so the tester
// can unit-test them without a database. Thin tenant/permission helpers are
// defined here for use by the API routes.
//
// FROZEN rules (docs/specs/notices.md §6):
//   - A notice is visible only if `publishedAt <= now` and (`expiresAt` is null
//     or `now <= expiresAt`).
//   - Audience filters: if `audienceJson.schoolIds` is non-empty, user must
//     belong to one; if `roles` non-empty, user's role must match; empty
//     audience = all users in the school.
//   - `pinned` notices sort first.
//   - Read receipt recorded once per user per notice.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';

// ---- Constants ---------------------------------------------------------------

export const NOTICE_CATEGORIES = {
    EXAM: 'EXAM',
    FEE: 'FEE',
    HOLIDAY: 'HOLIDAY',
    EVENT: 'EVENT',
    GENERAL: 'GENERAL',
} as const;

// ---- Pure helpers (unit-tested) ----------------------------------------------

export interface NoticeAudience {
    roles?: string[];
    schoolIds?: string[];
}

/** Parses the `audienceJson` column into a typed audience. Empty/invalid → {}. */
export function parseAudience(audienceJson: string | null | undefined): NoticeAudience {
    if (!audienceJson) return {};
    try {
        const parsed = JSON.parse(audienceJson) as { roles?: unknown; schoolIds?: unknown };
        return {
            roles: Array.isArray(parsed?.roles) ? (parsed.roles as string[]) : undefined,
            schoolIds: Array.isArray(parsed?.schoolIds) ? (parsed.schoolIds as string[]) : undefined,
        };
    } catch {
        return {};
    }
}

/**
 * True when a notice is inside its publication window:
 *   `publishedAt <= now` AND (`expiresAt` is null OR `now <= expiresAt`).
 */
export function isNoticeVisible(
    publishedAt: Date | string | number,
    expiresAt: Date | string | number | null | undefined,
    now: Date | string | number = new Date()
): boolean {
    const t = +new Date(now);
    if (+new Date(publishedAt) > t) return false;
    if (expiresAt != null && +new Date(expiresAt) < t) return false;
    return true;
}

/**
 * True when a user's (schoolId, role) matches the notice's audience.
 *  - If `schoolIds` is non-empty the user must belong to one of them.
 *  - If `roles` is non-empty the user's role must be in the set.
 *  - Empty audience (no filters) matches everyone.
 */
export function matchesAudience(
    audienceJson: string | null | undefined,
    context: { schoolId: string; role: string }
): boolean {
    const audience = parseAudience(audienceJson);
    if (audience.schoolIds?.length && !audience.schoolIds.includes(context.schoolId)) {
        return false;
    }
    if (audience.roles?.length && !audience.roles.includes(context.role)) {
        return false;
    }
    return true;
}

// ---- Tenant filter (mirrors library/certificates-core) -----------------------

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

/** Publishing/editing/deleting notices requires `notices.manage`. */
export function requireNoticesManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Notices management permission required');
}

/** Read-only board access requires `notices.view` OR `notices.manage`. */
export function requireNoticesView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Notices view permission required');
}
