import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';
import {
  toDateKey,
  buildRegisterMatrix,
  computeTeacherSummary,
} from '@/lib/attendance-core';

export const dynamic = 'force-dynamic';

const REGISTER_ROLES = ['FACULTY', 'DEAN', 'REGISTRAR_ADMIN', 'SUPER_ADMIN'];

const monthPattern = /^\d{4}-\d{2}$/;

// ---------------------------------------------------------------------------
// GET /api/attendance/register?courseId=&month=YYYY-MM&schoolId=
//   (FACULTY, DEAN, REGISTRAR_ADMIN, SUPER_ADMIN)
//   200 {
//     header: string[] /* "DD Mon" dates in the month with >=1 record, ascending */,
//     rows: [{ studentId, rollNo, name, cells: ("P"|"A"|null)[], present, total,
//             percentage, absentDates }],
//     teachers: [{ teacherId, teacherName, markedCount }],
//   }
// `cells[i]` = P/A when a record exists for that student on header[i]'s date,
// else null. present/total/percentage computed over recorded days only. Central
// officers must send schoolId; course must belong to that school.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!REGISTER_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to the attendance register');
    }

    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseId');
    const schoolQuery = url.searchParams.get('schoolId');
    const month = url.searchParams.get('month');

    if (!courseId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'courseId is required');
    }
    if (!month || !monthPattern.test(month)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'month must be in YYYY-MM format');
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    if (!Number.isInteger(year) || monthNum < 1 || monthNum > 12) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'month must be a valid YYYY-MM period');
    }
    const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
    const monthEnd = new Date(Date.UTC(year, monthNum, 1));

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

      const records = await db.attendanceRecord.findMany({
        where: {
          courseId,
          schoolId: tenant,
          date: { gte: monthStart, lt: monthEnd },
        },
        select: { studentId: true, status: true, date: true, markedById: true },
      });

      const studentIds = Array.from(new Set(records.map((r) => r.studentId)));
      const students = studentIds.length
        ? await db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, rollNo: true, firstName: true, lastName: true },
          })
        : [];
      const studentMap: Record<string, { rollNo: string; name: string }> = {};
      for (const s of students) {
        studentMap[s.id] = { rollNo: s.rollNo, name: `${s.firstName} ${s.lastName}` };
      }

      const matrixRecords = records.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        date: toDateKey(r.date),
      }));
      const { header, rows } = buildRegisterMatrix(matrixRecords, studentMap);

      // Per-teacher marking summary (distinct dates marked).
      const teacherIds = Array.from(new Set(records.map((r) => r.markedById).filter(Boolean) as string[]));
      const teacherRows = teacherIds.length
        ? await db.user.findMany({
            where: { id: { in: teacherIds } },
            select: { id: true, name: true },
          })
        : [];
      const teacherName: Record<string, string> = {};
      for (const t of teacherRows) teacherName[t.id] = t.name;

      const teacherSummary = computeTeacherSummary(
        records.map((r) => ({ date: toDateKey(r.date), markedById: r.markedById })),
        teacherName
      );
      const teachers = teacherSummary.map((t) => ({
        teacherId: t.teacherId,
        teacherName: t.teacherName,
        markedCount: t.markedCount,
      }));

      return successResponse({ header, rows, teachers });
    });
  } catch (error) {
    return errorResponse(error);
  }
});
