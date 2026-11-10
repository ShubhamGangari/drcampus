import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import {
    tenantFilter,
    userHasPermission,
    requireParentView,
    canParentViewStudent,
    loadWardDetail,
} from '@/lib/parent-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/parent/students/[studentId]?schoolId=
// Read-only detail for ONE linked ward. Requires `parent.view`. If the target
// student is not linked to the authenticated parent account -> 403 (spec §6.1).
// 200 { detail: { summary, attendance, fees, results, exams } }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user, params }) => {
    try {
        const canView = await userHasPermission(user, 'parent.view');
        if (!canView) throw requireParentView();

        const studentId = params.studentId;
        if (!studentId) throw new ApiError(400, 'BAD_REQUEST', 'studentId is required');

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const detail = await withClient(user, async (db) => {
            const tenant = tenantFilter(isCentralUser(user), schoolId);

            const links = await db.parentStudentLink.findMany({
                where: { ...tenant, parentUserId: user.userId },
                select: { parentUserId: true, studentId: true },
            });
            if (!canParentViewStudent(user.userId, studentId, links)) {
                throw new ApiError(403, 'FORBIDDEN', 'This student is not linked to your account');
            }

            return loadWardDetail(db, tenant, studentId);
        });

        return successResponse({ detail });
    } catch (error) {
        return errorResponse(error);
    }
});
