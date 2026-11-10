import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import {
    requireSuperAdmin,
    BUILTIN_ROLES,
    assertCustomRoleScope,
} from '@/lib/rbac-admin';
import { LEGAL_POSITIONS, Position, UserRole } from '@/lib/perms';
import { prismaBase } from '@/lib/prisma';
import { z } from 'zod';

const patchUserSchema = z
    .object({
        role: z.enum(BUILTIN_ROLES).optional(),
        position: z.string().nullable().optional(),
        customRoleId: z.string().nullable().optional(),
        active: z.boolean().optional(),
    })
    .refine(
        (d) => d.role !== undefined || d.position !== undefined || d.customRoleId !== undefined || d.active !== undefined,
        { message: 'At least one field must be provided' }
    );

// PATCH /api/rbac/users/[id] — update an officer (role / position / custom role / active).
// Spec §4.3. SUPER_ADMIN only.
export const PATCH = withAuth(async (request, { user, params }) => {
    requireSuperAdmin(user);

    const userId = params.id;
    const target = await prismaBase.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, position: true, schoolId: true, customRoleId: true, active: true },
    });
    if (!target) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const data = await validateBody(request, patchUserSchema);

    const isSuperAdminTarget = target.role === 'SUPER_ADMIN';

    // Cannot change a SUPER_ADMIN's role (spec §4.3). A SUPER_ADMIN can never be
    // given a built-in role, so any `role` change on one is forbidden.
    if (isSuperAdminTarget && data.role !== undefined) {
        throw new ApiError(400, 'CANNOT_CHANGE_SUPER_ADMIN', 'The SUPER_ADMIN role cannot be changed');
    }

    // SUPER_ADMIN cannot be deactivated and cannot hold a custom role.
    const effectiveRole: UserRole = (data.role ?? target.role) as UserRole;
    if (effectiveRole === 'SUPER_ADMIN') {
        if (data.active === false) {
            throw new ApiError(400, 'CANNOT_DEACTIVATE_SUPER_ADMIN', 'The SUPER_ADMIN account cannot be deactivated');
        }
        if (data.customRoleId != null) {
            throw new ApiError(400, 'CANNOT_ASSIGN_SUPER_ADMIN', 'The SUPER_ADMIN account cannot have a custom role');
        }
    }

    // Position must be legal for the effective role.
    if (data.position !== undefined && data.position !== null) {
        const legal = LEGAL_POSITIONS[effectiveRole];
        const pos = data.position as Position;
        if (!legal.includes(pos)) {
            throw new ApiError(400, 'INVALID_POSITION', `Position "${data.position}" is not legal for role ${effectiveRole}`);
        }
    }

    // Custom role must exist and match the user's school scope.
    let customRoleId = target.customRoleId;
    if (data.customRoleId !== undefined) {
        if (data.customRoleId == null) {
            customRoleId = null;
        } else {
            const roleRow = await prismaBase.role.findUnique({
                where: { id: data.customRoleId },
                select: { id: true, schoolId: true },
            });
            if (!roleRow) {
                throw new ApiError(404, 'ROLE_NOT_FOUND', 'Custom role not found');
            }
            assertCustomRoleScope(target.schoolId, roleRow);
            customRoleId = data.customRoleId;
        }
    }

    const updated = await prismaBase.user.update({
        where: { id: userId },
        data: {
            ...(data.role !== undefined ? { role: data.role } : {}),
            ...(data.position !== undefined ? { position: data.position } : {}),
            ...(data.customRoleId !== undefined ? { customRoleId } : {}),
            ...(data.active !== undefined ? { active: data.active } : {}),
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            position: true,
            customRoleId: true,
            schoolId: true,
            active: true,
        },
    });

    return successResponse({ user: updated });
});
