import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createMeetingSchema } from '@/lib/mentorship-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    canLogMeeting,
} from '@/lib/mentorship-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/mentorship/meetings — log a meeting on an ACTIVE pairing. 201 { meeting }
// Gates:
//   - pairing must exist (404);
//   - meetings are only allowed on ACTIVE pairings (400).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createMeetingSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const meeting = await withClient(user, async (db) => {
            const pairing = await db.mentorshipPairing.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: body.pairingId },
            });
            if (!pairing) {
                throw new ApiError(404, 'PAIRING_NOT_FOUND', 'Mentorship pairing not found');
            }
            if (!canLogMeeting(pairing.status)) {
                throw new ApiError(
                    400,
                    'PAIRING_NOT_ACTIVE',
                    'Meetings can only be logged on active pairings'
                );
            }

            const created = await db.mentorshipMeeting.create({
                data: {
                    schoolId: tenant,
                    pairingId: body.pairingId,
                    date: new Date(body.date),
                    notes: body.notes ?? null,
                },
            });

            return {
                id: created.id,
                pairingId: created.pairingId,
                date: created.date.toISOString(),
                notes: created.notes,
                createdAt: created.createdAt.toISOString(),
            };
        });

        return successResponse({ meeting }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
