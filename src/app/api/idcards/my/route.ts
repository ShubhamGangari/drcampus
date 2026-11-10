import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { getMyCard } from '@/lib/idcards-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/idcards/my — the current user's own card.
// STUDENT → matched by email→student; STAFF → by userId; SUPER_ADMIN → none.
// Returns 200 { card }, or 404 when the account has no card / is not a holder.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const card = await withClient(user, (db) => getMyCard(db, user, user.schoolId));
        if (!card) {
            throw new ApiError(404, 'NOT_FOUND', 'No ID card issued for this account');
        }
        return successResponse({ card });
    } catch (error) {
        return errorResponse(error);
    }
});
