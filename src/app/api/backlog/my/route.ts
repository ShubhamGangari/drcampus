import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { findSelfStudent, tenantFilter } from '@/lib/backlog-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/backlog/my
// Lists the logged-in student's own backlogs (self-service). 200
// { backlogs: [{ id, courseCode, courseTitle, semester, academicYear, marks,
//                grade, status }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const backlogs = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const rows = await db.backlogEntry.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    studentId: self.id,
                },
                orderBy: { createdAt: 'desc' },
            });

            const courseIds = Array.from(new Set(rows.map((r) => r.courseId)));
            const courses = courseIds.length
                ? await db.course.findMany({
                    where: { id: { in: courseIds } },
                    select: { id: true, code: true, title: true },
                })
                : [];
            const courseMap = new Map(courses.map((c) => [c.id, c]));

            return rows.map((r) => ({
                id: r.id,
                courseCode: courseMap.get(r.courseId)?.code ?? null,
                courseTitle: courseMap.get(r.courseId)?.title ?? null,
                semester: r.semester,
                academicYear: r.academicYear,
                marks: r.marks,
                grade: r.grade,
                status: r.status,
            }));
        });

        return successResponse({ backlogs });
    } catch (error) {
        return errorResponse(error);
    }
});
