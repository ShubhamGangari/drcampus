import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse } from '@/lib/api';
import {
    tenantFilter,
    userHasPermission,
    requireParentView,
    loadWardCards,
} from '@/lib/parent-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/parent/students?schoolId=
// Returns only the wards linked to the authenticated parent account. Gated by
// `parent.view` (the built-in PARENT role carries it). Strictly read-only.
// 200 { students: [{ id, name, rollNo, program, className, attendancePercent,
//                    feeDues, gpa, unreadNotices }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const canView = await userHasPermission(user, 'parent.view');
        if (!canView) throw requireParentView();

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const students = await withClient(user, async (db) => {
            const tenant = tenantFilter(isCentralUser(user), schoolId);
            return loadWardCards(db, tenant, user.userId);
        });

        return successResponse({ students });
    } catch (error) {
        return errorResponse(error);
    }
});
