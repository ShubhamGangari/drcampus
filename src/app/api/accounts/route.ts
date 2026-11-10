import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { prismaBase, withClient, isCentralUser } from '@/lib/prisma';
import { ensureSchoolExists } from '@/lib/rbac-admin';
import { resolveCreateTenant } from '@/lib/student-lifecycle';
import { delegateDenialReason, BUILTIN_ROLES } from '@/lib/delegate';
import { LEGAL_POSITIONS, Position, UserRole } from '@/lib/perms';
import { writeAuditLog } from '@/lib/audit-writer';
import { z } from 'zod';

const createAccountSchema = z.object({
    schoolId: z.string().min(1).optional(),
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(BUILTIN_ROLES),
    position: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
});

// POST /api/accounts — delegated account creation (spec §4.2).
// Authorization is delegation-based (not SUPER_ADMIN-only): the server
// recomputes `canDelegate(actor, target)` and rejects with 403 when the actor
// may not create the requested target within their scope.
export const POST = withAuth(async (request, { user }) => {
    const data = await validateBody(request, createAccountSchema);

    return await withClient(user, async (db) => {
        const targetSchoolId = resolveCreateTenant(user, data.schoolId);

        // Resolve the actor's own department.
        let actorDepartmentId: string | null = null;
        if (!isCentralUser(user)) {
            const me = await db.user.findUnique({
                where: { id: user.userId },
                select: { departmentId: true },
            });
            if (me) actorDepartmentId = me.departmentId;
        }

        // Effective target department: for DEAN / FACULTY actors the department is
        // fixed to their own (spec §3.1); an explicit different one is rejected by
        // the delegation gate below.
        const role = data.role as string;
        let targetDepartmentId = data.departmentId ?? null;
        if ((role === 'DEAN' || role === 'FACULTY') && actorDepartmentId) {
            targetDepartmentId = data.departmentId ?? actorDepartmentId;
        }

        const actor = {
            role: user.role,
            position: user.position ?? null,
            schoolId: user.schoolId,
            departmentId: actorDepartmentId,
        };
        const target = {
            role,
            position: data.position ?? null,
            schoolId: targetSchoolId,
            departmentId: targetDepartmentId,
        };

        // Delegation gate → 403.
        const denial = delegateDenialReason(actor, target);
        if (denial) {
            throw new ApiError(403, 'FORBIDDEN', `You cannot create this account (${denial})`);
        }

        await ensureSchoolExists(targetSchoolId);

        // Department must exist within the target school (when provided).
        if (targetDepartmentId) {
            const dept = await prismaBase.department.findFirst({
                where: { id: targetDepartmentId, schoolId: targetSchoolId },
                select: { id: true },
            });
            if (!dept) {
                throw new ApiError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found in the selected school');
            }
        }

        // Unique email → 409 EMAIL_EXISTS.
        const existingEmail = await prismaBase.user.findUnique({
            where: { email: data.email },
            select: { id: true },
        });
        if (existingEmail) {
            throw new ApiError(409, 'EMAIL_EXISTS', 'A user with this email already exists');
        }

        // Position must be legal for the assigned role (defense in depth).
        if (data.position != null) {
            const legal = LEGAL_POSITIONS[role as UserRole];
            const pos = data.position as Position;
            if (!legal.includes(pos)) {
                throw new ApiError(400, 'INVALID_POSITION', `Position "${data.position}" is not legal for role ${role}`);
            }
        }

        const passwordHash = await hashPassword(data.password);

        const created = await prismaBase.user.create({
            data: {
                schoolId: targetSchoolId,
                name: data.name,
                email: data.email,
                password: passwordHash,
                role,
                position: data.position ?? null,
                departmentId: targetDepartmentId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                position: true,
                departmentId: true,
                schoolId: true,
                active: true,
            },
        });

        await writeAuditLog(prismaBase, {
            schoolId: targetSchoolId,
            actorId: user.userId,
            action: 'ACCOUNT_CREATED',
            entityType: 'USER',
            entityId: created.id,
            summary: `${user.role} created ${role} account for ${created.name}`,
            metadata: JSON.stringify({
                email: created.email,
                role,
                position: created.position,
                departmentId: created.departmentId,
            }),
        });

        return successResponse({ user: created }, 201);
    });
});
