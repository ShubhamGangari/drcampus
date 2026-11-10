import { prismaBase } from './prisma';
import { Permission, parseRolePermissions, resolveEffectivePermissions } from './perms';

/**
 * Resolve a user record's effective permission array (spec §2):
 *   1. SUPER_ADMIN → all catalog permissions (bypass).
 *   2. customRoleId set → exactly that custom role's permissions (replace).
 *   3. Else → static matrix: ROLE_FALLBACK[role] ∪ POSITION_GRANTS[position].
 *
 * Fetches the custom-role row on demand so the resolved set stays fresh even if
 * the admin edits the role after the user last logged in.
 */
export async function resolveUserEffectivePermissions(user: {
    role: string;
    position?: string | null;
    customRoleId?: string | null;
}): Promise<Permission[]> {
    let customRolePermissions: string[] | null = null;
    if (user.customRoleId) {
        const role = await prismaBase.role.findUnique({
            where: { id: user.customRoleId },
        });
        customRolePermissions = role ? parseRolePermissions(role.permissionsJson) : null;
    }
    return resolveEffectivePermissions({
        role: user.role,
        position: user.position,
        customRoleId: user.customRoleId,
        customRolePermissions,
    });
}
