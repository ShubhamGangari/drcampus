import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateClubSchema } from '@/lib/clubs-schemas';
import { resolveCreateTenant, userHasPermission, findSelfStudent, requireClubsManage } from '@/lib/clubs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/clubs/[id] — edit a club (clubs.manage OR the club coordinator).
// Body: { description?, coordinatorUserId? }. 200 { club }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        const body = await validateBody(request, updateClubSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const club = await withClient(user, async (db) => {
            const existing = await db.club.findUnique({ where: { id: params.id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Club not found');
            }
            if (existing.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Club does not belong to this school');
            }

            const canManage = await userHasPermission(user, 'clubs.manage');
            if (!canManage) {
                const self = await findSelfStudent(db, user);
                if (!self || self.id !== existing.coordinatorUserId) {
                    throw requireClubsManage();
                }
            }

            const data: Record<string, unknown> = {};
            if (body.name !== undefined) data.name = body.name;
            if (body.category !== undefined) data.category = body.category;
            if (body.description !== undefined) data.description = body.description;
            if (body.coordinatorUserId !== undefined) data.coordinatorUserId = body.coordinatorUserId;

            // Auto-join a newly assigned coordinator as a member.
            if (
                body.coordinatorUserId !== undefined &&
                body.coordinatorUserId !== null &&
                body.coordinatorUserId !== existing.coordinatorUserId
            ) {
                await db.clubMembership.upsert({
                    where: {
                        clubId_studentId: { clubId: existing.id, studentId: body.coordinatorUserId },
                    },
                    create: { clubId: existing.id, studentId: body.coordinatorUserId, role: 'COORDINATOR' },
                    update: { role: 'COORDINATOR' },
                });
            }

            return db.club.update({ where: { id: existing.id }, data });
        });

        return successResponse({ club });
    } catch (error) {
        return errorResponse(error);
    }
});
