import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import {
    tenantFilter,
    findSelfStudent,
    computeSGPA,
    computeCGPA,
} from '@/lib/gradecard-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/gradecard/semester?semester=&academicYear=&schoolId=
// Returns course-level results for one semester plus SGPA / CGPA. Self-service.
// 200 { courses: [{ code, title, credits, internalMarks, externalMarks,
//                   totalMarks, grade }], sgpa, cgpa }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const semesterParam = url.searchParams.get('semester');
        const academicYear = url.searchParams.get('academicYear');

        if (!semesterParam || Number.isNaN(Number(semesterParam))) {
            throw new ApiError(400, 'BAD_REQUEST', 'semester is required');
        }
        const semester = Number(semesterParam);

        const result = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const tenant = tenantFilter(isCentralUser(user), schoolId);

            const entries = await db.marksEntry.findMany({
                where: { ...tenant, studentId: self.id, grade: { not: null } },
                select: { scheduleId: true, grade: true, internalMarks: true, externalMarks: true, totalMarks: true },
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
                    select: { id: true, code: true, title: true, credits: true },
                })
                : [];
            const courseMap = new Map(courses.map((c) => [c.id, c]));

            const rows: Array<{
                credits: number;
                grade: string;
                internalMarks: number;
                externalMarks: number;
                totalMarks: number;
                code?: string;
                title?: string;
            }> = [];

            for (const entry of entries) {
                const exam = examMap.get(scheduleToExam.get(entry.scheduleId) ?? '');
                if (!exam || exam.semester !== semester) continue;
                if (academicYear && exam.academicYear !== academicYear) continue;
                const course = courseMap.get(scheduleToCourse.get(entry.scheduleId) ?? '');
                rows.push({
                    credits: course?.credits ?? 0,
                    grade: entry.grade ?? 'F',
                    internalMarks: entry.internalMarks,
                    externalMarks: entry.externalMarks,
                    totalMarks: entry.totalMarks,
                    code: course?.code,
                    title: course?.title,
                });
            }

            // CGPA across all semesters of the same academic year (or all).
            const yearFilter = academicYear ? { academicYear } : {};
            const allExams = await db.exam.findMany({
                where: { ...tenant, ...yearFilter },
                select: { id: true, semester: true },
            });
            const allExamIds = allExams.map((e) => e.id);
            const allSchedules = allExamIds.length
                ? await db.examSchedule.findMany({
                    where: { ...tenant, examId: { in: allExamIds } },
                    select: { id: true },
                })
                : [];
            const allScheduleIds = allSchedules.map((s) => s.id);
            const allEntries = allScheduleIds.length
                ? await db.marksEntry.findMany({
                    where: { ...tenant, studentId: self.id, scheduleId: { in: allScheduleIds }, grade: { not: null } },
                    select: { grade: true },
                })
                : [];

            // Group by course to credit-weight SGPA of a semester correctly.
            const sgpa = computeSGPA(rows);
            const cgpa = computeCGPA(
                allEntries.length ? [{ sgpa: computeSGPA(allEntries.map((e) => ({ credits: 1, grade: e.grade ?? 'F' }))) }] : []
            );

            return {
                courses: rows.map((r) => ({
                    code: r.code,
                    title: r.title,
                    credits: r.credits,
                    internalMarks: r.internalMarks,
                    externalMarks: r.externalMarks,
                    totalMarks: r.totalMarks,
                    grade: r.grade,
                })),
                sgpa,
                cgpa,
            };
        });

        return successResponse(result);
    } catch (error) {
        return errorResponse(error);
    }
});
