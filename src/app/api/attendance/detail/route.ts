import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';
import { findSelfStudent } from '@/lib/fee-core';
import { computeTeacherSummary } from '@/lib/attendance-core';

export const dynamic = 'force-dynamic';

const VIEW_ROLES = ['FACULTY', 'STUDENT', 'DEAN', 'REGISTRAR_ADMIN', 'SUPER_ADMIN'];

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// GET /api/attendance/detail?courseId=&studentId=&schoolId=&teacherId=
//   (FACULTY, STUDENT, DEAN, REGISTRAR_ADMIN)
//   200 {
//     student?: { studentId, rollNo, name } | null,
//     days: [{ recordId, date, status, markedById, teacherName }],
//     teachers: [{ teacherId, teacherName, markedCount, dates }],
//   }
// Supports drill-down: per-student day-by-day present/absent (when studentId is
// supplied) and a per-teacher "Marked by" summary (always). `teacherId` further
// filters the day list to records marked by that teacher.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        if (!VIEW_ROLES.includes(user.role)) {
            throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this report');
        }

        const url = new URL(request.url);
        const courseId = url.searchParams.get('courseId');
        const studentParam = url.searchParams.get('studentId');
        const teacherParam = url.searchParams.get('teacherId');
        const schoolQuery = url.searchParams.get('schoolId');

        if (!courseId) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'courseId is required');
        }

        return await withClient(user, async (db) => {
            const tenant =
                user.schoolId === 'ALL'
                    ? schoolQuery
                        ? schoolQuery
                        : (() => {
                            throw new ApiError(400, 'SCHOOL_ID_REQUIRED', 'Central officers must specify a schoolId');
                        })()
                    : user.schoolId;

            await assertCourseBelongsToSchool(db, courseId, tenant);

            let studentId: string | undefined = studentParam ?? undefined;
            if (user.role === 'STUDENT') {
                const self = await findSelfStudent(db, user);
                studentId = self?.id ?? undefined;
            }

            const where: Record<string, unknown> = { courseId, schoolId: tenant };
            if (studentId) where.studentId = studentId;
            if (teacherParam) where.markedById = teacherParam;

            const records = await db.attendanceRecord.findMany({
                where,
                select: { id: true, studentId: true, date: true, status: true, markedById: true },
                orderBy: { date: 'desc' },
            });

            // Resolve teacher names for any markedById referenced by these records.
            const teacherIds = Array.from(new Set(records.map((r) => r.markedById).filter(Boolean) as string[]));
            const teachers =
                teacherIds.length > 0
                    ? await db.user.findMany({
                        where: { id: { in: teacherIds } },
                        select: { id: true, name: true },
                    })
                    : [];
            const teacherName: Record<string, string> = {};
            for (const t of teachers) teacherName[t.id] = t.name;

            const days = records.map((r) => ({
                recordId: r.id,
                date: isoDate(r.date),
                status: r.status as 'PRESENT' | 'ABSENT',
                markedById: r.markedById ?? null,
                teacherName: r.markedById ? teacherName[r.markedById] ?? null : null,
            }));

            let student: { studentId: string; rollNo: string; name: string } | null = null;
            if (studentId && days.length > 0) {
                const s = await db.student.findUnique({
                    where: { id: studentId },
                    select: { id: true, rollNo: true, firstName: true, lastName: true },
                });
                if (s) {
                    student = { studentId: s.id, rollNo: s.rollNo, name: `${s.firstName} ${s.lastName}` };
                }
            }

            return successResponse({
                student,
                days,
                teachers: computeTeacherSummary(days, teacherName),
            });
        });
    } catch (error) {
        return errorResponse(error);
    }
});
