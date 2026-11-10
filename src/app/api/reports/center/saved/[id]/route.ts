import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { deleteSavedReport } from '@/lib/reports-center-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// DELETE /api/reports/center/saved/[id]
// Deletes a saved report owned by the authenticated user within their school.
// Deleting another user's (or another school's) report → 404. Success → 200.
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
    try {
        const url = new URL(request.url);
        const schoolId = isCentralUser(user)
            ? (url.searchParams.get('schoolId') ?? '')
            : user.schoolId;

        const deleted = await withClient(user, async (db) =>
            deleteSavedReport(db, schoolId, user.userId, params.id)
        );

        if (!deleted) {
            throw new ApiError(404, 'NOT_FOUND', 'Saved report not found');
        }
        return successResponse({ deleted: true });
    } catch (error) {
        return errorResponse(error);
    }
});
