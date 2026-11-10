import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { tenantFilter, findSelfStudent, computeSGPA, type GradeEntry } from '@/lib/gradecard-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/gradecard/semesters
// Lists the logged-in student's semesters with computed SGPA. Self-service. 200
// { semesters: [{ semester, academicYear, sgpa, credits, courseCount }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const semesters = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const tenant = tenantFilter(isCentralUser(user), schoolId);

            const entries = await db.marksEntry.findMany({
                where: { ...tenant, studentId: self.id, grade: { not: null } },
                select: { scheduleId: true, grade: true },
            });

            const scheduleIds = Array.from(new Set(entries.map((e) => e.scheduleId)));
            const schedules = scheduleIds.length
                ? await db.examSchedule.findMany({
                    where: { ...tenant, id: { in: scheduleIds } },
                    select: { id: true, examId: true, courseId: true },
                })
                : [];
            const scheduleToExam = new Map(schedules.map((s) => [s.id, s.examId]));
            const scheduleToCourse = new Map(schedules.map((s) => [s.id, s.courseId]));

            const examIds = Array.from(new Set(schedules.map((s) => s.examId)));
            const exams = examIds.length
                ? await db.exam.findMany({
                    where: { ...tenant, id: { in: examIds } },
                    select: { id: true, semester: true, academicYear: true },
                })
                : [];
            const examMap = new Map(exams.map((e) => [e.id, e]));

            const courseIds = Array.from(new Set(schedules.map((s) => s.courseId)));
            const courses = courseIds.length
                ? await db.course.findMany({
                    where: { ...tenant, id: { in: courseIds } },
                    select: { id: true, credits: true },
                })
                : [];
            const creditMap = new Map(courses.map((c) => [c.id, c.credits]));

            type GroupedEntry = GradeEntry & { scheduleId: string };
            const groups = new Map<string, GroupedEntry[]>();
            for (const entry of entries) {
                const exam = examMap.get(scheduleToExam.get(entry.scheduleId) ?? '');
                if (!exam) continue;
                const key = `${exam.semester}|${exam.academicYear}`;
                const credits = creditMap.get(scheduleToCourse.get(entry.scheduleId) ?? '') ?? 0;
                const list = groups.get(key) ?? [];
                list.push({ credits, grade: entry.grade ?? 'F', scheduleId: entry.scheduleId });
                groups.set(key, list);
            }

            const out: Array<{ semester: number; academicYear: string; sgpa: number; credits: number; courseCount: number }> = [];
            for (const [key, list] of Array.from(groups.entries())) {
                const [semesterStr, academicYear] = key.split('|');
                out.push({
                    semester: Number(semesterStr),
                    academicYear,
                    sgpa: computeSGPA(list),
                    credits: list.reduce((sum, e) => sum + e.credits, 0),
                    courseCount: list.length,
                });
            }
            out.sort((a, b) => b.semester - a.semester || b.academicYear.localeCompare(a.academicYear));
            return out;
        });

        return successResponse({ semesters });
    } catch (error) {
        return errorResponse(error);
    }
});
