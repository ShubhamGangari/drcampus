import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createExamSchema } from '@/lib/backlog-schemas';
import {
    tenantFilter,
    resolveCreateTenant,
    userHasPermission,
    requireBacklogManage,
} from '@/lib/backlog-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/backlog/exams
// Lists supplementary exams (public to logged-in users). 200
// { exams: [{ id, courseCode, title, scheduleDate, venue }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const exams = await withClient(user, async (db) => {
            const rows = await db.supplementaryExam.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { scheduleDate: 'asc' },
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
                title: courseMap.get(r.courseId)?.title ?? null,
                scheduleDate: r.scheduleDate,
                venue: r.venue,
            }));
        });

        return successResponse({ exams });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/backlog/exams  (manage — backlog.manage)
// Admin schedules a supplementary exam for a course. 201 { exam }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createExamSchema);

        if (!(await userHasPermission(user, 'backlog.manage'))) {
            throw requireBacklogManage();
        }

        const exam = await withClient(user, async (db) => {
            const tenant = resolveCreateTenant(user, body.schoolId);

            const course = await db.course.findUnique({
                where: { id: body.courseId },
                select: { id: true, schoolId: true },
            });
            if (!course) {
                throw new ApiError(404, 'NOT_FOUND', 'Course not found');
            }
            if (isCentralUser(user) && course.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Course does not belong to this school');
            }

            return db.supplementaryExam.create({
                data: {
                    schoolId: tenant,
                    courseId: body.courseId,
                    scheduleDate: new Date(body.scheduleDate),
                    venue: body.venue ?? null,
                    status: 'SCHEDULED',
                },
            });
        });

        return successResponse({ exam }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
