import { withAuth, successResponse } from '@/lib/api';
import { withClient, isCentralUser } from '@/lib/prisma';
import {
    createableRoles,
    canManageAllDepartments,
    scopeLabel,
} from '@/lib/delegate';

// GET /api/accounts/capabilities — delegation scope + creatable roles for the
// current user (spec §4.1). Authorized: any authenticated user.
export const GET = withAuth(async (_request, { user }) => {
    const actor = {
        role: user.role,
        position: user.position ?? null,
        schoolId: user.schoolId,
    };

    return await withClient(user, async (db) => {
        // Resolve the actor's own department (only meaningful for non-central users).
        let departmentId: string | null = null;
        if (!isCentralUser(user)) {
            const me = await db.user.findUnique({
                where: { id: user.userId },
                select: { departmentId: true },
            });
            if (me) departmentId = me.departmentId;
        }
        const fullActor = { ...actor, departmentId };

        const roles = createableRoles(fullActor);
        const canCreate = roles.length > 0;
        const manageAllDepts = canManageAllDepartments(fullActor);

        // Departments are only surfaced to SUPER_ADMIN / REGISTRAR_ADMIN.
        let departments: Array<{ id: string; name: string }> | undefined;
        if (manageAllDepts) {
            const rows = await db.department.findMany({
                where: isCentralUser(user) ? {} : { schoolId: user.schoolId },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            });
            departments = rows.map((d) => ({ id: d.id, name: d.name }));
        }

        // Department name (for the scope label).
        let departmentName: string | null = null;
        if (departmentId) {
            const dept = await db.department.findUnique({
                where: { id: departmentId },
                select: { name: true },
            });
            if (dept) departmentName = dept.name;
        }

        const scope = {
            schoolId: user.schoolId,
            departmentId,
            scopeLabel: scopeLabel(fullActor, departmentName),
        };

        return successResponse({ canCreate, scope, roles, departments });
    });
});
