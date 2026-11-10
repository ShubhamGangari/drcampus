import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse } from '@/lib/api';
import { tenantFilter } from '@/lib/registration-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/registration/catalog?schoolId=&semester=&type=
// Any authenticated user may browse the course catalog (self-service). 200
// { courses: [{ id, code, title, credits, semester, type, seatsTotal,
//              seatsFilled, instructorName }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const semesterParam = url.searchParams.get('semester');
        const type = url.searchParams.get('type');

        const courses = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            if (semesterParam && !Number.isNaN(Number(semesterParam))) {
                where.semester = Number(semesterParam);
            }
            if (type) where.type = type;

            const rows = await db.course.findMany({
                where,
                orderBy: [{ semester: 'asc' }, { code: 'asc' }],
            });

            // Elective seat fill counts (exclude DROPPED registrations).
            const courseIds = rows.map((c) => c.id);
            const counts = courseIds.length
                ? await db.courseRegistration.groupBy({
                    by: ['courseId'],
                    where: {
                        ...tenantFilter(isCentralUser(user), schoolId),
                        courseId: { in: courseIds },
                        status: { not: 'DROPPED' },
                    },
                    _count: { _all: true },
                })
                : [];
            const countMap = new Map(counts.map((g) => [g.courseId, g._count._all]));

            return rows.map((c) => ({
                id: c.id,
                code: c.code,
                title: c.title,
                credits: c.credits,
                semester: c.semester,
                type: c.type,
                seatsTotal: c.seatsTotal,
                seatsFilled: countMap.get(c.id) ?? 0,
                instructorName: c.instructorName,
            }));
        });

        return successResponse({ courses });
    } catch (error) {
        return errorResponse(error);
    }
});
