import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';
import { toDateKey, computeWeeklyStats, buildAnalyticsTeachers } from '@/lib/attendance-core';

export const dynamic = 'force-dynamic';

const ANALYTICS_ROLES = ['FACULTY', 'DEAN', 'REGISTRAR_ADMIN', 'SUPER_ADMIN'];

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const parseOptionalDate = (raw: string | null, field: string, endOfDay: boolean): Date | undefined => {
  if (raw === null || raw === '') return undefined;
  if (!isoDatePattern.test(raw) || Number.isNaN(new Date(raw + 'T00:00:00.000Z').getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a valid date YYYY-MM-DD`);
  }
  return new Date(raw + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
};

// ---------------------------------------------------------------------------
// GET /api/attendance/analytics?courseId=&schoolId=&from=&to=
//   (FACULTY, DEAN, REGISTRAR_ADMIN, SUPER_ADMIN)
//   200 {
//     weeks: [{ weekLabel, present, absent }],
//     teachers: [{ teacherId, teacherName, markedCount, dates }],
//   }
// `weeks` groups records by ISO week (`Wk NN`) within [from, to] (default: all
// course records). `teachers` per marking teacher: markedCount = distinct dates
// marked, dates = ascending `DD Mon`. Central officers must send schoolId.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!ANALYTICS_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to attendance analytics');
    }

    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseId');
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

      const where: Record<string, unknown> = { courseId, schoolId: tenant };
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) (where.date as Record<string, Date>).gte = fromDate;
        if (toDate) (where.date as Record<string, Date>).lte = toDate;
      }

      const records = await db.attendanceRecord.findMany({
        where,
        select: { date: true, status: true, markedById: true },
      });

      const weeks = computeWeeklyStats(records.map((r) => ({ date: toDateKey(r.date), status: r.status })));

      const teacherIds = Array.from(new Set(records.map((r) => r.markedById).filter(Boolean) as string[]));
      const teacherRows = teacherIds.length
        ? await db.user.findMany({
            where: { id: { in: teacherIds } },
            select: { id: true, name: true },
          })
        : [];
      const teacherName: Record<string, string> = {};
      for (const t of teacherRows) teacherName[t.id] = t.name;

      const teachers = buildAnalyticsTeachers(
        records.map((r) => ({ date: toDateKey(r.date), markedById: r.markedById })),
        teacherName
      );

      return successResponse({ weeks, teachers });
    });
  } catch (error) {
    return errorResponse(error);
  }
});
