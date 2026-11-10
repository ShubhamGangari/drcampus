import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { memberActionSchema } from '@/lib/clubs-schemas';
import { findSelfStudent } from '@/lib/clubs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/clubs/[id]/members — JOIN / LEAVE a club (any authenticated user).
// Body: { action: JOIN | LEAVE }. 200 { club }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
    try {
        const body = await validateBody(request, memberActionSchema);

        const club = await withClient(user, async (db) => {
            const existingClub = await db.club.findUnique({ where: { id: params.id } });
            if (!existingClub) {
                throw new ApiError(404, 'NOT_FOUND', 'Club not found');
            }

            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(400, 'STUDENT_REQUIRED', 'No student profile linked to this account');
            }
            if (self.schoolId !== existingClub.schoolId) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Club does not belong to your school');
            }

            const membership = await db.clubMembership.findUnique({
                where: {
                    clubId_studentId: { clubId: existingClub.id, studentId: self.id },
                },
            });

            if (body.action === 'JOIN') {
                if (membership) {
                    throw new ApiError(409, 'ALREADY_MEMBER', 'Already a member of this club');
                }
                await db.clubMembership.create({
                    data: { clubId: existingClub.id, studentId: self.id, role: 'MEMBER' },
                });

                // RSVP count increments for every upcoming event of the club.
                await db.clubEvent.updateMany({
                    where: { clubId: existingClub.id, status: 'UPCOMING' },
                    data: { rsvpCount: { increment: 1 } },
                });
            } else {
                if (!membership) {
                    throw new ApiError(400, 'NOT_A_MEMBER', 'Not a member of this club');
                }
                await db.clubMembership.delete({ where: { id: membership.id } });
            }

            return {
                id: existingClub.id,
                name: existingClub.name,
                category: existingClub.category,
                description: existingClub.description,
                action: body.action,
            };
        });

        return successResponse({ club });
    } catch (error) {
        return errorResponse(error);
    }
});
