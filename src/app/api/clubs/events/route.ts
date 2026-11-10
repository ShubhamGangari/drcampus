import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createEventSchema } from '@/lib/clubs-schemas';
import { resolveCreateTenant, tenantFilter, userHasPermission, findSelfStudent, requireClubsManage } from '@/lib/clubs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/clubs/events?future=true&schoolId=
// 200 { events: [{ id, clubId, clubName, title, date, venue, status, rsvpCount }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const future = url.searchParams.get('future') === 'true';

        const events = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            if (future) {
                where.date = { gte: new Date() };
            }

            const rows = await db.clubEvent.findMany({
                where,
                orderBy: { date: 'asc' },
                include: { club: { select: { name: true } } },
            });

            return rows.map((e) => ({
                id: e.id,
                clubId: e.clubId,
                clubName: e.club.name,
                title: e.title,
                date: e.date,
                venue: e.venue,
                status: e.status,
                rsvpCount: e.rsvpCount,
            }));
        });

        return successResponse({ events });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/clubs/events — create an event (clubs.manage OR club coordinator).
// 201 { event }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createEventSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const event = await withClient(user, async (db) => {
            const club = await db.club.findUnique({ where: { id: body.clubId } });
            if (!club) {
                throw new ApiError(404, 'NOT_FOUND', 'Club not found');
            }
            if (club.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Club does not belong to this school');
            }

            const canManage = await userHasPermission(user, 'clubs.manage');
            if (!canManage) {
                const self = await findSelfStudent(db, user);
                if (!self || self.id !== club.coordinatorUserId) {
                    throw requireClubsManage();
                }
            }

            return db.clubEvent.create({
                data: {
                    schoolId: tenant,
                    clubId: club.id,
                    title: body.title,
                    description: body.description ?? null,
                    date: new Date(body.date),
                    venue: body.venue ?? null,
                },
            });
        });

        return successResponse({ event }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
