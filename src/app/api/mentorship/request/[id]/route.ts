import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { updateMentorshipRequestSchema } from '@/lib/mentorship-schemas';
import {
    tenantFilter,
    findSelfMentor,
    canApplyRequestAction,
    resolveStudentNames,
    REQUEST_STATUS,
} from '@/lib/mentorship-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/mentorship/request/[id]?schoolId=
// A mentor responds to a pending request. 200 { request }
//   - only the mentor who owns the profile may respond (403);
//   - only PENDING requests may be acted on (400);
//   - ACCEPT creates an ACTIVE pairing; REJECT sets REJECTED.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        const body = await validateBody(request, updateMentorshipRequestSchema);

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const result = await withClient(user, async (db) => {
            const mentor = await findSelfMentor(db, user);
            if (!mentor) {
                throw new ApiError(403, 'FORBIDDEN', 'Only mentors may respond to requests');
            }

            const existing = await db.mentorshipRequest.findFirst({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    id: params.id,
                },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Mentorship request not found');
            }
            if (existing.mentorId !== mentor.id) {
                throw new ApiError(403, 'FORBIDDEN', 'This request is not addressed to you');
            }
            if (!canApplyRequestAction(existing.status, body.action)) {
                throw new ApiError(
                    400,
                    'INVALID_REQUEST_ACTION',
                    `Cannot ${body.action} a ${existing.status} request`
                );
            }

            const nextStatus = body.action === 'ACCEPT' ? REQUEST_STATUS.ACCEPTED : REQUEST_STATUS.REJECTED;

            const updated = await db.mentorshipRequest.update({
                where: { id: params.id },
                data: { status: nextStatus },
            });

            if (body.action === 'ACCEPT') {
                const existingPairing = await db.mentorshipPairing.findFirst({
                    where: { schoolId: updated.schoolId, mentorId: updated.mentorId, studentId: updated.studentId },
                });
                if (!existingPairing) {
                    await db.mentorshipPairing.create({
                        data: {
                            schoolId: updated.schoolId,
                            mentorId: updated.mentorId,
                            studentId: updated.studentId,
                            status: 'ACTIVE',
                        },
                    });
                }
            }

            const studentNames = await resolveStudentNames(db, [updated.studentId]);

            return {
                id: updated.id,
                mentorId: updated.mentorId,
                mentorName: mentor.name,
                studentId: updated.studentId,
                studentName: studentNames.get(updated.studentId) ?? 'Student',
                message: updated.message,
                status: updated.status,
                createdAt: updated.createdAt.toISOString(),
            };
        });

        return successResponse({ request: result });
    } catch (error) {
        return errorResponse(error);
    }
});
