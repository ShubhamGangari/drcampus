import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { tenantFilter, userHasPermission } from '@/lib/registration-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/registration/all?schoolId=&courseId=&semester=
// Lists registrations across students (registration.view OR registration.manage).
// 200 { registrations: [{ id, studentId, studentName, courseId, courseCode,
//                          semester, academicYear, status }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const hasView = await userHasPermission(user, 'registration.view');
        const hasManage = await userHasPermission(user, 'registration.manage');
        if (!hasView && !hasManage) {
            throw new ApiError(403, 'FORBIDDEN', 'Registration view permission required');
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const courseId = url.searchParams.get('courseId') ?? undefined;
        const semesterParam = url.searchParams.get('semester');

        const registrations = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            if (courseId) where.courseId = courseId;
            if (semesterParam && !Number.isNaN(Number(semesterParam))) {
                where.semester = Number(semesterParam);
            }

            const rows = await db.courseRegistration.findMany({
                where,
                orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }],
            });

            const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
            const courseIds = Array.from(new Set(rows.map((r) => r.courseId)));

            const [students, courses] = await Promise.all([
                studentIds.length
                    ? db.student.findMany({
                        where: { id: { in: studentIds } },
                        select: { id: true, firstName: true, lastName: true, rollNo: true },
                    })
                    : Promise.resolve([]),
                courseIds.length
                    ? db.course.findMany({
                        where: { id: { in: courseIds } },
                        select: { id: true, code: true },
                    })
                    : Promise.resolve([]),
            ]);

            const studentMap = new Map(students.map((s) => [s.id, s]));
            const courseMap = new Map(courses.map((c) => [c.id, c]));

            return rows.map((r) => {
                const student = studentMap.get(r.studentId);
                return {
                    id: r.id,
                    studentId: r.studentId,
                    studentName: student ? `${student.firstName} ${student.lastName}`.trim() : null,
                    rollNo: student?.rollNo ?? null,
                    courseId: r.courseId,
                    courseCode: courseMap.get(r.courseId)?.code ?? null,
                    semester: r.semester,
                    academicYear: r.academicYear,
                    status: r.status,
                };
            });
        });

        return successResponse({ registrations });
    } catch (error) {
        return errorResponse(error);
    }
});
