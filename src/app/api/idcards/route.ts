import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { listCards, requireIdCardsView, userHasPermission } from '@/lib/idcards-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/idcards?type=STUDENT|STAFF&status=ACTIVE|REVOKED&schoolId=
//   Lists issued cards within a school (view/manage).
//   - School-scoped users: their own school (auto-scoped).
//   - Central officers: must pass `?schoolId=` to target a tenant.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const canManage = await userHasPermission(user, 'idcards.manage');
        const canView = await userHasPermission(user, 'idcards.view');
        if (!canManage && !canView) throw requireIdCardsView();

        const url = new URL(request.url);
        const schoolId = isCentralUser(user)
            ? url.searchParams.get('schoolId')?.trim() || undefined
            : user.schoolId;

        if (!schoolId) {
            throw new ApiError(400, 'SCHOOL_ID_REQUIRED', 'Central officers must specify a schoolId');
        }

        const type = url.searchParams.get('type')?.trim() || undefined;
        if (type && type !== 'STUDENT' && type !== 'STAFF') {
            throw new ApiError(400, 'VALIDATION_ERROR', 'type must be STUDENT or STAFF');
        }

        const status = url.searchParams.get('status')?.trim() || undefined;
        if (status && status !== 'ACTIVE' && status !== 'REVOKED') {
            throw new ApiError(400, 'VALIDATION_ERROR', 'status must be ACTIVE or REVOKED');
        }

        const cards = await withClient(user, (db) => listCards(db, schoolId, { status }));
        return successResponse({ cards });
    } catch (error) {
        return errorResponse(error);
    }
});
