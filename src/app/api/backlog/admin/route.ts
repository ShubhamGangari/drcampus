import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse } from '@/lib/api';
import { tenantFilter, userHasPermission, requireBacklogView } from '@/lib/backlog-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/backlog/admin?status=  (backlog.view OR backlog.manage)
// Admin registry of revaluation requests, joined to student + course. 200
// { requests: [{ id, studentName, courseCode, semester, status, createdAt }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const status = url.searchParams.get('status') ?? undefined;

        const canView = await userHasPermission(user, 'backlog.view');
        const canManage = await userHasPermission(user, 'backlog.manage');
        if (!canView && !canManage) {
            throw requireBacklogView();
        }

        const requests = await withClient(user, async (db) => {
            const rows = await db.revaluationRequest.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    ...(status ? { status } : {}),
                },
                orderBy: { createdAt: 'desc' },
            });

            const backlogIds = Array.from(new Set(rows.map((r) => r.backlogId)));
            const backlogs = backlogIds.length
                ? await db.backlogEntry.findMany({ where: { id: { in: backlogIds } } })
                : [];
            const backlogMap = new Map(backlogs.map((b) => [b.id, b]));

            const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
            const students = studentIds.length
                ? await db.student.findMany({
                    where: { id: { in: studentIds } },
                    select: { id: true, firstName: true, lastName: true },
                })
                : [];
            const studentMap = new Map(students.map((s) => [s.id, s]));

            const courseIds = Array.from(new Set(backlogs.map((b) => b.courseId)));
            const courses = courseIds.length
                ? await db.course.findMany({
                    where: { id: { in: courseIds } },
                    select: { id: true, code: true },
                })
                : [];
            const courseMap = new Map(courses.map((c) => [c.id, c]));

            return rows.map((r) => {
                const bl = backlogMap.get(r.backlogId);
                const st = studentMap.get(r.studentId);
                return {
                    id: r.id,
                    studentName: st ? `${st.firstName} ${st.lastName}` : null,
                    courseCode: bl ? (courseMap.get(bl.courseId)?.code ?? null) : null,
                    semester: bl?.semester ?? null,
                    status: r.status,
                    createdAt: r.createdAt,
                };
            });
        });

        return successResponse({ requests });
    } catch (error) {
        return errorResponse(error);
    }
});
