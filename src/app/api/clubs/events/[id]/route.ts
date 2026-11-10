import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateEventSchema } from '@/lib/clubs-schemas';
import { resolveCreateTenant, userHasPermission, findSelfStudent, requireClubsManage, canTransitionEventStatus } from '@/lib/clubs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/clubs/events/[id] — update / cancel an event (clubs.manage OR the
// club coordinator). Body: { title?, date?, venue?, description?, status? }.
// Cancel = status → CANCELLED (UPCOMING only). 200 { event }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        const body = await validateBody(request, updateEventSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const event = await withClient(user, async (db) => {
            const existing = await db.clubEvent.findUnique({ where: { id: params.id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Event not found');
            }
            if (existing.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Event does not belong to this school');
            }

            const club = await db.club.findUnique({ where: { id: existing.clubId } });
            if (!club) {
                throw new ApiError(404, 'NOT_FOUND', 'Club not found');
            }

            const canManage = await userHasPermission(user, 'clubs.manage');
            if (!canManage) {
                const self = await findSelfStudent(db, user);
                if (!self || self.id !== club.coordinatorUserId) {
                    throw requireClubsManage();
                }
            }

            if (body.status !== undefined && !canTransitionEventStatus(existing.status, body.status)) {
                throw new ApiError(
                    400,
                    'INVALID_TRANSITION',
                    'Only UPCOMING events can transition to COMPLETED or CANCELLED'
                );
            }

            const data: Record<string, unknown> = {};
            if (body.title !== undefined) data.title = body.title;
            if (body.date !== undefined) data.date = new Date(body.date);
            if (body.venue !== undefined) data.venue = body.venue;
            if (body.description !== undefined) data.description = body.description;
            if (body.status !== undefined) data.status = body.status;

            return db.clubEvent.update({ where: { id: existing.id }, data });
        });

        return successResponse({ event });
    } catch (error) {
        return errorResponse(error);
    }
});
