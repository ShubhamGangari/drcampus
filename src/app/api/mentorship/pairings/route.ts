import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createPairingSchema } from '@/lib/mentorship-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    requireMentorshipManage,
    resolveMentorNames,
    resolveStudentNames,
} from '@/lib/mentorship-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/mentorship/pairings — staff force-pairs a mentor and student.
// 201 { pairing }
// Gates:
//   - requires mentorship.manage (403);
//   - mentor and student must exist (404);
//   - duplicate mentor↔student pairing (409).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'mentorship.manage'))) {
            requireMentorshipManage();
        }

        const body = await validateBody(request, createPairingSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const pairing = await withClient(user, async (db) => {
            const mentor = await db.mentorProfile.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: body.mentorId },
            });
            if (!mentor) {
                throw new ApiError(404, 'MENTOR_NOT_FOUND', 'Mentor not found');
            }

            const student = await db.student.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: body.studentId },
            });
            if (!student) {
                throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
            }

            const existing = await db.mentorshipPairing.findFirst({
                where: { schoolId: tenant, mentorId: body.mentorId, studentId: body.studentId },
            });
            if (existing) {
                throw new ApiError(
                    409,
                    'DUPLICATE_PAIRING',
                    'A pairing already exists for this mentor and student'
                );
            }

            const created = await db.mentorshipPairing.create({
                data: {
                    schoolId: tenant,
                    mentorId: body.mentorId,
                    studentId: body.studentId,
                    status: 'ACTIVE',
                },
            });

            const [mentorNames, studentNames] = await Promise.all([
                resolveMentorNames(db, [created.mentorId]),
                resolveStudentNames(db, [created.studentId]),
            ]);

            return {
                id: created.id,
                mentorId: created.mentorId,
                mentorName: mentorNames.get(created.mentorId) ?? 'Mentor',
                studentId: created.studentId,
                studentName: studentNames.get(created.studentId) ?? 'Student',
                status: created.status,
                createdAt: created.createdAt.toISOString(),
            };
        });

        return successResponse({ pairing }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
