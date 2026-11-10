import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createMentorshipRequestSchema } from '@/lib/mentorship-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    findSelfStudent,
    requireMentorshipJoin,
    resolveMentorNames,
} from '@/lib/mentorship-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/mentorship/request — a student requests a mentor. 201 { request }
// Gates:
//   - requester must be a student (403);
//   - mentor must exist (404) and be available (409);
//   - duplicate student→mentor request (409).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createMentorshipRequestSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const requestRow = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw requireMentorshipJoin();
            }

            const mentor = await db.mentorProfile.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: body.mentorId },
            });
            if (!mentor) {
                throw new ApiError(404, 'MENTOR_NOT_FOUND', 'Mentor not found');
            }
            if (!mentor.available) {
                throw new ApiError(409, 'MENTOR_UNAVAILABLE', 'This mentor is currently unavailable');
            }

            const existing = await db.mentorshipRequest.findFirst({
                where: { schoolId: tenant, mentorId: body.mentorId, studentId: self.id },
            });
            if (existing) {
                throw new ApiError(409, 'DUPLICATE_REQUEST', 'You have already requested this mentor');
            }

            const created = await db.mentorshipRequest.create({
                data: {
                    schoolId: tenant,
                    mentorId: body.mentorId,
                    studentId: self.id,
                    message: body.message ?? null,
                    status: 'PENDING',
                },
            });

            const mentorNames = await resolveMentorNames(db, [created.mentorId]);

            return {
                id: created.id,
                mentorId: created.mentorId,
                mentorName: mentorNames.get(created.mentorId) ?? 'Mentor',
                studentId: created.studentId,
                studentName: `${self.firstName} ${self.lastName}`.trim(),
                message: created.message,
                status: created.status,
                createdAt: created.createdAt.toISOString(),
            };
        });

        return successResponse({ request: requestRow }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
