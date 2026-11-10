import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { registerExamSchema } from '@/lib/backlog-schemas';
import { tenantFilter, assertStudentBelongsToSchool } from '@/lib/backlog-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/backlog/exams/:id/register
// Register a student for a supplementary exam. Requires an existing, uncleared
// backlog for the course (else 400 NO_BACKLOG_FOR_COURSE). 201 { registration }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
    try {
        const body = await validateBody(request, registerExamSchema);

        const registration = await withClient(user, async (db) => {
            const exam = await db.supplementaryExam.findUnique({ where: { id: params.id } });
            if (!exam) {
                throw new ApiError(404, 'NOT_FOUND', 'Supplementary exam not found');
            }

            const tenant = exam.schoolId;
            const student = await assertStudentBelongsToSchool(db, body.studentId, tenant);

            // Must hold an uncleared backlog for the exam's course.
            const backlog = await db.backlogEntry.findFirst({
                where: {
                    ...tenantFilter(isCentralUser(user), tenant),
                    studentId: student.id,
                    courseId: exam.courseId,
                    status: { not: 'CLEARED' },
                },
            });
            if (!backlog) {
                throw new ApiError(400, 'NO_BACKLOG_FOR_COURSE', 'Student has no backlog for this course');
            }

            const existing = await db.supplementaryRegistration.findFirst({
                where: { examId: exam.id, studentId: student.id },
            });
            if (existing) {
                throw new ApiError(409, 'DUPLICATE_REGISTRATION', 'Student is already registered for this supplementary exam');
            }

            return db.supplementaryRegistration.create({
                data: {
                    schoolId: tenant,
                    examId: exam.id,
                    studentId: student.id,
                },
            });
        });

        return successResponse({ registration }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
