import { prismaBase } from './prisma';
import { ApiError } from './errors';
import {
    Permission,
    isPermission,
    parseRolePermissions,
} from './perms';

// ---------------------------------------------------------------------------
// Shared backend helpers for the Dynamic RBAC API (/api/rbac/*).
// All endpoints are SUPER_ADMIN only (spec §4).
// ---------------------------------------------------------------------------

/** The 6 built-in roles (excludes SUPER_ADMIN). A custom role / officer may
 *  only be assigned one of these; SUPER_ADMIN is never assignable. */
export const BUILTIN_ROLES = [
    'FACULTY',
    'FINANCE_OFFICER',
    'EXAM_CONTROLLER',
    'DEAN',
    'STUDENT',
    'REGISTRAR_ADMIN',
] as const;

export type BuiltinRole = (typeof BUILTIN_ROLES)[number];

/** Throws 403 unless the caller is SUPER_ADMIN. */
export function requireSuperAdmin(user: { role: string }): void {
    if (user.role !== 'SUPER_ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'Super admin access required');
    }
}

/** Validates that a schoolId exists (404 SCHOOL_NOT_FOUND). No-op when null. */
export async function ensureSchoolExists(schoolId: string | null | undefined): Promise<void> {
    if (!schoolId) return;
    const school = await prismaBase.school.findUnique({
        where: { id: schoolId },
        select: { id: true },
    });
    if (!school) {
        throw new ApiError(404, 'SCHOOL_NOT_FOUND', 'School not found');
    }
}

interface RoleRow {
    id: string;
    name: string;
    description: string | null;
    schoolId: string | null;
    permissionsJson: string;
    createdAt: Date;
}

/** Convert a Role row (permissionsJson) into the API view (permissions array). */
export function toRoleView(role: RoleRow & { _count?: { users: number } }) {
    return {
        id: role.id,
        name: role.name,
        description: role.description,
        schoolId: role.schoolId,
        permissions: parseRolePermissions(role.permissionsJson),
        userCount: role._count?.users ?? 0,
        createdAt: role.createdAt,
    };
}

/** Validates a permissions payload is a non-empty, unique catalog subset → 400. */
export function requireValidPermissions(permissions: unknown): Permission[] {
    if (!Array.isArray(permissions) || permissions.length === 0) {
        throw new ApiError(400, 'INVALID_PERMISSIONS', 'At least one valid catalog permission is required');
    }
    const unique = Array.from(new Set(permissions as string[]));
    for (const p of unique) {
        if (!isPermission(p)) {
            throw new ApiError(400, 'INVALID_PERMISSIONS', `Invalid permission: ${p}`);
        }
    }
    return unique as Permission[];
}

/** A school-scoped custom role may only be assigned to a user in that school. */
export function assertCustomRoleScope(
    targetSchoolId: string | null | undefined,
    role: { schoolId: string | null }
): void {
    if (role.schoolId && role.schoolId !== targetSchoolId) {
        throw new ApiError(400, 'ROLE_SCOPE_MISMATCH', 'This custom role is scoped to a different school');
    }
}
