import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    errorResponse,
    ApiError,
} from '@/lib/api';
import {
    tenantFilter,
    userHasPermission,
    requireMentorshipManage,
} from '@/lib/mentorship-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// DELETE /api/mentorship/pairings/[id]?schoolId=
// Ends an ACTIVE pairing (sets status to ENDED). 204
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'mentorship.manage'))) {
            requireMentorshipManage();
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        await withClient(user, async (db) => {
            const pairing = await db.mentorshipPairing.findFirst({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    id: params.id,
                },
            });
            if (!pairing) {
                throw new ApiError(404, 'PAIRING_NOT_FOUND', 'Mentorship pairing not found');
            }

            await db.mentorshipPairing.update({
                where: { id: params.id },
                data: { status: 'ENDED' },
            });
        });

        return new Response(null, { status: 204 });
    } catch (error) {
        return errorResponse(error);
    }
});
