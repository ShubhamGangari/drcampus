import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, ApiError } from '@/lib/api';
import { loadCourseTenant } from '@/lib/obe-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/obe/reports/course-attainment?courseId=&academicYear= — course CO
// attainment report (read roles). 200 { courseId, courseCode, academicYear,
// cos: [{ coId, coCode, attainment }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const courseId = url.searchParams.get('courseId');
  const academicYear = url.searchParams.get('academicYear');

  if (!guardRole(user.role, 'FACULTY', 'DEAN', 'REGISTRAR_ADMIN')) {
    throw new ApiError(403, 'FORBIDDEN', 'Faculty, dean or registrar access required');
  }

  return withClient(user, async (db) => {
    if (!courseId) {
      return successResponse({ courseId: null, courseCode: null, academicYear: null, cos: [] });
    }

    const { tenant, course } = await loadCourseTenant(db, user, courseId);

    const rows = await db.cOAttainment.findMany({
      where: { schoolId: tenant, courseId, academicYear: academicYear ?? undefined },
      select: { coId: true, attainment: true },
      orderBy: { coId: 'asc' },
    });

    if (rows.length === 0) {
      return successResponse({ courseId, courseCode: course.code, academicYear, cos: [] });
    }

    const coIds = Array.from(new Set(rows.map((r) => r.coId)));
    const cos = await db.courseOutcome.findMany({
      where: { schoolId: tenant, id: { in: coIds } },
      select: { id: true, code: true },
    });
    const coCode = new Map(cos.map((c) => [c.id, c.code]));

    const list = rows.map((r) => ({
      coId: r.coId,
      coCode: coCode.get(r.coId) ?? null,
      attainment: r.attainment,
    }));

    return successResponse({
      courseId,
      courseCode: course.code,
      academicYear,
      cos: list,
    });
  });
});
