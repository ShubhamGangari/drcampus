import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateMembershipSchema } from '@/lib/library-schemas';
import { userHasPermission } from '@/lib/library-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/library/memberships/[userId] — update a membership (library.manage).
// Body `{ active?: boolean, type?: string }`.   200 { membership }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library management permission required');
        }

        const body = await validateBody(request, updateMembershipSchema);
        const userId = params.id;

        const membership = await withClient(user, async (db) => {
            const existing = await db.libraryMembership.findFirst({
                where: { userId },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Membership not found');
            }

            const updated = await db.libraryMembership.update({
                where: { id: existing.id },
                data: {
                    active: body.active !== undefined ? body.active : existing.active,
                    type: body.type ?? existing.type,
                },
            });

            return {
                id: updated.id,
                userId: updated.userId,
                type: updated.type,
                active: updated.active,
            };
        });

        return successResponse({ membership });
    } catch (error) {
        return errorResponse(error);
    }
});
