import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';
import { buildAttendanceRows } from '@/lib/attendance-core';

export const dynamic = 'force-dynamic';

const DEFAULTER_ROLES = ['FACULTY', 'DEAN', 'REGISTRAR_ADMIN'];
const DEFAULT_THRESHOLD = 75;

// ---------------------------------------------------------------------------
// GET /api/attendance/defaulter?courseId=&threshold=&schoolId=
//   (FACULTY, DEAN, REGISTRAR_ADMIN)
//   200 [{ studentId, rollNo, name, totalDays, presentDays, percentage }]
//   for percentage < threshold (strict less-than; threshold defaults to 75).
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!DEFAULTER_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to the defaulter report');
    }

    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseId');
    const schoolQuery = url.searchParams.get('schoolId');
    const thresholdRaw = url.searchParams.get('threshold');

    if (!courseId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'courseId is required');
    }

    const threshold = thresholdRaw !== null && thresholdRaw.trim() !== '' ? Number(thresholdRaw) : DEFAULT_THRESHOLD;
    if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'threshold must be a number between 0 and 100');
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

      const records = await db.attendanceRecord.findMany({
        where: { courseId, schoolId: tenant },
        select: { studentId: true, status: true },
      });

      const rows = await buildAttendanceRows(db, records);
      const defaulters = rows.filter(
        (r) => r.percentage !== null && r.percentage < threshold
      );

      return successResponse(defaulters);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
