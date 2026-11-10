import { withAuth, successResponse, ApiError } from '@/lib/api';
import { assertProgramBelongsToSchool } from '@/lib/fee-core';
import {
  aggregateNba,
  assertReportViewer,
  computePassRate,
  computeProgramPOAttainmentAvg,
  loadPublishedMarksRows,
  requireAcademicYear,
  resolveReportScope,
} from '@/lib/report-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/reports/nba?programId=&academicYear=&schoolId= — program-level NBA
// metrics (REGISTRAR_ADMIN / DEAN only).
// 200 { programId, academicYear, metrics: [{ key, label, value }] }
// 403 wrong role | 400 missing academicYear / missing programId / central
//     without schoolId / bad schoolId | 404 unknown program
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  assertReportViewer(user);

  const url = new URL(request.url);
  const academicYear = requireAcademicYear(url);
  const programId = url.searchParams.get('programId');
  if (!programId || !programId.trim()) {
    throw new ApiError(400, 'MISSING_PROGRAM_ID', 'programId query parameter is required');
  }

  const { db, schoolId } = await resolveReportScope(request, user);
  // Validates the program exists (404) and belongs to the resolved tenant (400).
  await assertProgramBelongsToSchool(db, programId.trim(), schoolId);

  const [studentsInProgram, courses, marksRows, poAttainmentAvg] = await Promise.all([
    db.student.count({ where: { schoolId, programId: programId.trim() } }),
    db.course.count({ where: { schoolId, programId: programId.trim() } }),
    loadPublishedMarksRows(db, { schoolId, academicYear, programId: programId.trim() }),
    computeProgramPOAttainmentAvg(db, {
      schoolId,
      academicYear,
      programId: programId.trim(),
    }),
  ]);

  const metrics = aggregateNba({
    studentsInProgram,
    courses,
    passRate: computePassRate(marksRows),
    poAttainmentAvg,
  });

  return successResponse({ programId: programId.trim(), academicYear, metrics });
});
