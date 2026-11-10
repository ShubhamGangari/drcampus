import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import {
    tenantFilter,
    userHasPermission,
    requireParentManage,
} from '@/lib/parent-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// DELETE /api/parent/links/[id]?schoolId=
// Removes a ParentStudentLink (admin). Requires `parent.manage`.
// Removing a link immediately hides that ward from the parent's portal.
// 200 { deleted: true }
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
    try {
        const canManage = await userHasPermission(user, 'parent.manage');
        if (!canManage) throw requireParentManage();

        const id = params.id;
        if (!id) throw new ApiError(400, 'BAD_REQUEST', 'id is required');

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        await withClient(user, async (db) => {
            const tenant = tenantFilter(isCentralUser(user), schoolId);
            await db.parentStudentLink.deleteMany({ where: { ...tenant, id } });
        });

        return successResponse({ deleted: true });
    } catch (error) {
        return errorResponse(error);
    }
});
