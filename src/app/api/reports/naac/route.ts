import { withAuth, successResponse } from '@/lib/api';
import {
  aggregateNaac,
  assertReportViewer,
  computePassRate,
  loadPublishedMarksRows,
  requireAcademicYear,
  resolveReportScope,
} from '@/lib/report-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/reports/naac?academicYear=&schoolId= — institution-level NAAC
// metrics (REGISTRAR_ADMIN / DEAN only).
// 200 { academicYear, metrics: [{ key, label, value }] }
// 403 wrong role | 400 missing academicYear / central without schoolId / bad schoolId
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  assertReportViewer(user);

  const url = new URL(request.url);
  const academicYear = requireAcademicYear(url);
  const { db, schoolId } = await resolveReportScope(request, user);

  const [totalStudents, totalFaculty, programs, courses, marksRows] = await Promise.all([
    db.student.count({ where: { schoolId } }),
    db.user.count({ where: { schoolId, role: 'FACULTY' } }),
    db.program.count({ where: { schoolId } }),
    db.course.count({ where: { schoolId } }),
    loadPublishedMarksRows(db, { schoolId, academicYear }),
  ]);

  const metrics = aggregateNaac({
    totalStudents,
    totalFaculty,
    programs,
    courses,
    passRate: computePassRate(marksRows),
  });

  return successResponse({ academicYear, metrics });
});
