import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import {
    requireSuperAdmin,
    toRoleView,
    requireValidPermissions,
} from '@/lib/rbac-admin';
import { serializeRolePermissions } from '@/lib/perms';
import { prismaBase } from '@/lib/prisma';
import { z } from 'zod';

const patchRoleSchema = z
    .object({
        name: z.string().min(2).max(60).optional(),
        description: z.string().nullable().optional(),
        permissions: z.array(z.string()).optional(),
    })
    .refine((d) => d.name !== undefined || d.description !== undefined || d.permissions !== undefined, {
        message: 'At least one field must be provided',
    });

// PATCH /api/rbac/roles/[id] — update a custom role. Scope (schoolId) is immutable.
export const PATCH = withAuth(async (request, { user, params }) => {
    requireSuperAdmin(user);

    const roleId = params.id;
    const existing = await prismaBase.role.findUnique({
        where: { id: roleId },
        select: { id: true, schoolId: true },
    });
    if (!existing) {
        throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    const data = await validateBody(request, patchRoleSchema);

    // Duplicate name within the same (immutable) scope.
    if (data.name !== undefined) {
        const dup = await prismaBase.role.findFirst({
            where: { schoolId: existing.schoolId, name: data.name, NOT: { id: roleId } },
            select: { id: true },
        });
        if (dup) {
            throw new ApiError(409, 'ROLE_NAME_EXISTS', `A role named "${data.name}" already exists in this scope`);
        }
    }

    const permissions =
        data.permissions !== undefined ? requireValidPermissions(data.permissions) : null;

    const role = await prismaBase.role.update({
        where: { id: roleId },
        data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(permissions !== null ? { permissionsJson: serializeRolePermissions(permissions) } : {}),
        },
    });

    return successResponse({ role: toRoleView(role) });
});

// DELETE /api/rbac/roles/[id] — delete a role (409 if in use).
export const DELETE = withAuth(async (_request, { user, params }) => {
    requireSuperAdmin(user);

    const roleId = params.id;
    const existing = await prismaBase.role.findUnique({
        where: { id: roleId },
        select: { id: true },
    });
    if (!existing) {
        throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    const assignedCount = await prismaBase.user.count({
        where: { customRoleId: roleId },
    });
    if (assignedCount > 0) {
        throw new ApiError(409, 'ROLE_IN_USE', 'This role is assigned to one or more users and cannot be deleted');
    }

    await prismaBase.role.delete({ where: { id: roleId } });
    return successResponse({ success: true });
});
