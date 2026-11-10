import { withAuth, successResponse } from '@/lib/api';
import {
  aggregateNirf,
  assertReportViewer,
  computePassRate,
  computeStudentFacultyRatio,
  loadPublishedMarksRows,
  requireAcademicYear,
  resolveReportScope,
} from '@/lib/report-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/reports/nirf?academicYear=&schoolId= — NIRF dashboard metrics
// (REGISTRAR_ADMIN / DEAN only).
// 200 { academicYear, metrics: [{ key, label, value }] }
// 403 wrong role | 400 missing academicYear / central without schoolId / bad schoolId
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  assertReportViewer(user);

  const url = new URL(request.url);
  const academicYear = requireAcademicYear(url);
  const { db, schoolId } = await resolveReportScope(request, user);

  const [studentStrength, totalFaculty, programs, marksRows] = await Promise.all([
    db.student.count({ where: { schoolId } }),
    db.user.count({ where: { schoolId, role: 'FACULTY' } }),
    db.program.count({ where: { schoolId } }),
    loadPublishedMarksRows(db, { schoolId, academicYear }),
  ]);

  const metrics = aggregateNirf({
    studentStrength,
    studentFacultyRatio: computeStudentFacultyRatio(studentStrength, totalFaculty),
    graduationOutput: computePassRate(marksRows),
    programs,
  });

  return successResponse({ academicYear, metrics });
});
