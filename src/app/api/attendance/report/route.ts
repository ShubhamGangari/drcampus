import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';
import { findSelfStudent } from '@/lib/fee-core';
import { buildAttendanceRows } from '@/lib/attendance-core';

export const dynamic = 'force-dynamic';

const VIEW_ROLES = ['FACULTY', 'STUDENT', 'DEAN', 'REGISTRAR_ADMIN'];

// ---------------------------------------------------------------------------
// GET /api/attendance/report?courseId=&studentId=&schoolId=
//   (FACULTY, STUDENT, DEAN, REGISTRAR_ADMIN)
//   200 [{ studentId, rollNo, name, totalDays, presentDays, percentage }]
// Student role sees only their own row (assert student belongs to school);
// central officers must send schoolId; course must belong to that school.
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

      const records = await db.attendanceRecord.findMany({
        where,
        select: { studentId: true, status: true },
      });

      const rows = await buildAttendanceRows(db, records);
      return successResponse(rows);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
