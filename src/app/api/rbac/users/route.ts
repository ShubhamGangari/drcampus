import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import {
    requireSuperAdmin,
    ensureSchoolExists,
    BUILTIN_ROLES,
    assertCustomRoleScope,
} from '@/lib/rbac-admin';
import { LEGAL_POSITIONS, Position } from '@/lib/perms';
import { hashPassword } from '@/lib/auth';
import { prismaBase } from '@/lib/prisma';
import { z } from 'zod';

// GET /api/rbac/users?q=&role=&schoolId=&customRoleId= — officer list.
// Spec §4.3. SUPER_ADMIN only.
export const GET = withAuth(async (request, { user }) => {
    requireSuperAdmin(user);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const role = searchParams.get('role');
    const schoolId = searchParams.get('schoolId');
    const customRoleId = searchParams.get('customRoleId');

    const where: Record<string, unknown> = {};
    if (q) {
        where.OR = [{ name: { contains: q } }, { email: { contains: q } }];
    }
    if (role) where.role = role;
    if (schoolId) where.schoolId = schoolId;
    if (customRoleId) where.customRoleId = customRoleId;

    const users = await prismaBase.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            position: true,
            schoolId: true,
            customRoleId: true,
            active: true,
        },
    });

    return successResponse({ users });
});

const createOfficerSchema = z.object({
    schoolId: z.string().min(1),
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(BUILTIN_ROLES),
    position: z.string().nullable().optional(),
    customRoleId: z.string().nullable().optional(),
});

// POST /api/rbac/users — create an officer account (spec §4.3).
export const POST = withAuth(async (request, { user }) => {
    requireSuperAdmin(user);

    const data = await validateBody(request, createOfficerSchema);
    await ensureSchoolExists(data.schoolId);

    // Unique email → 409 EMAIL_EXISTS.
    const existingEmail = await prismaBase.user.findUnique({
        where: { email: data.email },
        select: { id: true },
    });
    if (existingEmail) {
        throw new ApiError(409, 'EMAILILISTS', 'A user with this email already exists');
    }

    // Position must be legal for the assigned built-in role.
    if (data.position != null) {
        const legal = LEGAL_POSITIONS[data.role];
        const pos = data.position as Position;
        if (!legal.includes(pos)) {
            throw new ApiError(400, 'INVALID_POSITION', `Position "${data.position}" is not legal for role ${data.role}`);
        }
    }

    // Custom role must exist and match the user's school scope.
    let customRoleId: string | null = null;
    if (data.customRoleId != null) {
        const roleRow = await prismaBase.role.findUnique({
            where: { id: data.customRoleId },
            select: { id: true, schoolId: true },
        });
        if (!roleRow) {
            throw new ApiError(404, 'ROLE_NOT_FOUND', 'Custom role not found');
        }
        assertCustomRoleScope(data.schoolId, roleRow);
        customRoleId = data.customRoleId;
    }

    const passwordHash = await hashPassword(data.password);

    const created = await prismaBase.user.create({
        data: {
            schoolId: data.schoolId,
            name: data.name,
            email: data.email,
            password: passwordHash,
            role: data.role,
            position: data.position ?? null,
            customRoleId,
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

    return successResponse({ user: created }, 201);
});
