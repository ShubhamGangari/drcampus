import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { revokeCard, requireIdCardsManage, userHasPermission } from '@/lib/idcards-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/idcards/[id]/revoke — mark a card REVOKED (manage).
// Central officers must pass `?schoolId=` to scope the target tenant.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'idcards.manage'))) throw requireIdCardsManage();

        const url = new URL(request.url);
        const schoolId = isCentralUser(user)
            ? url.searchParams.get('schoolId')?.trim() || undefined
            : user.schoolId;

        if (!schoolId) {
            throw new ApiError(400, 'SCHOOL_ID_REQUIRED', 'Central officers must specify a schoolId');
        }

        const card = await withClient(user, (db) => revokeCard(db, schoolId, params.id));
        if (!card) {
            throw new ApiError(404, 'NOT_FOUND', 'Card not found');
        }
        return successResponse({ card });
    } catch (error) {
        return errorResponse(error);
    }
});
