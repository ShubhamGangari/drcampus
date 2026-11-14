import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';
import { findSelfStudent } from '@/lib/fee-core';
import { buildAttendanceRows, computeAbsentDatesByStudent } from '@/lib/attendance-core';

export const dynamic = 'force-dynamic';

const VIEW_ROLES = ['FACULTY', 'STUDENT', 'DEAN', 'REGISTRAR_ADMIN', 'SUPER_ADMIN'];

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const parseOptionalDate = (raw: string | null, field: string, endOfDay: boolean): Date | undefined => {
  if (raw === null || raw === '') return undefined;
  if (!isoDatePattern.test(raw) || Number.isNaN(new Date(raw + 'T00:00:00.000Z').getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a valid date YYYY-MM-DD`);
  }
  return new Date(raw + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
};

// ---------------------------------------------------------------------------
// GET /api/attendance/report?courseId=&studentId=&schoolId=&from=&to=
//   (FACULTY, STUDENT, DEAN, REGISTRAR_ADMIN, SUPER_ADMIN)
//   200 [{ studentId, rollNo, name, totalDays, presentDays, percentage, absentDates }]
// Optional `from`/`to` (YYYY-MM-DD) narrow the window: totals/percentage/absentDates
// are computed over records in [from, to] inclusive only.
// Student role sees only their own row; central officers must send schoolId;
// course must belong to that school.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!VIEW_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this report');
    }

    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseId');
    const studentParam = url.searchParams.get('studentId');
    const schoolQuery = url.searchParams.get('schoolId');

    if (!courseId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'courseId is required');
    }

    const fromDate = parseOptionalDate(url.searchParams.get('from'), 'from', false);
    const toDate = parseOptionalDate(url.searchParams.get('to'), 'to', true);
    if (fromDate && toDate && fromDate > toDate) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'from cannot be after to');
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
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) (where.date as Record<string, Date>).gte = fromDate;
        if (toDate) (where.date as Record<string, Date>).lte = toDate;
      }

      const records = await db.attendanceRecord.findMany({
        where,
        select: { studentId: true, status: true, date: true },
      });

      const rows = await buildAttendanceRows(db, records);
      const absentByStudent = computeAbsentDatesByStudent(records);

      return successResponse(
        rows.map((r) => ({ ...r, absentDates: absentByStudent.get(r.studentId) ?? [] }))
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
});
