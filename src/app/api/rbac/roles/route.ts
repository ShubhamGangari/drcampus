import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import {
    requireSuperAdmin,
    ensureSchoolExists,
    toRoleView,
    requireValidPermissions,
} from '@/lib/rbac-admin';
import { serializeRolePermissions } from '@/lib/perms';
import { prismaBase } from '@/lib/prisma';
import { z } from 'zod';

// GET /api/rbac/roles?schoolId= — list custom roles (spec §4.2).
// SUPER_ADMIN only. With schoolId → that school's roles + global roles;
// without → global + all school roles.
export const GET = withAuth(async (request, { user }) => {
    requireSuperAdmin(user);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    const where = schoolId
        ? { OR: [{ schoolId: null }, { schoolId }] }
        : {};

    const roles = await prismaBase.role.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { users: true } } },
    });

    return successResponse({ roles: roles.map(toRoleView) });
});

const createRoleSchema = z.object({
    schoolId: z.string().nullable().optional(),
    name: z.string().min(2).max(60),
    description: z.string().nullable().optional(),
    permissions: z.array(z.string()),
});

// POST /api/rbac/roles — create a custom role (spec §4.2).
export const POST = withAuth(async (request, { user }) => {
    requireSuperAdmin(user);

    const data = await validateBody(request, createRoleSchema);
    await ensureSchoolExists(data.schoolId);

    const permissions = requireValidPermissions(data.permissions);

    // Duplicate name within the same scope → 409 ROLE_NAME_EXISTS.
    const existing = await prismaBase.role.findFirst({
        where: { schoolId: data.schoolId ?? null, name: data.name },
        select: { id: true },
    });
    if (existing) {
        throw new ApiError(409, 'ROLE_NAME_EXISTS', `A role named "${data.name}" already exists in this scope`);
    }

    const role = await prismaBase.role.create({
        data: {
            schoolId: data.schoolId ?? null,
            name: data.name,
            description: data.description ?? null,
            permissionsJson: serializeRolePermissions(permissions),
        },
    });

    return successResponse({ role: toRoleView(role) }, 201);
});
