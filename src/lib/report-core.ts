// ==============================================================================
// NAAC/NBA/NIRF Reports module (Module 6) — backend business logic.
// Pure functions (pass rate, student–faculty ratio, metric composition) live here
// so the tester can unit-test them without a database. Thin DB helpers (tenant
// scope resolution, published-marks loading, PO-attainment averaging) are used by
// the API routes.
//
// Multi-tenant model:
//   - school-scoped users use the extended client (auto-injects schoolId);
//   - central 'ALL' controllers use the base client and must pass a `schoolId`
//     query param (validated against the School table); every count is then
//     scoped to that school.
// ==============================================================================

import type { AuthPayload } from './auth';
import { ApiError } from './errors';
import { isCentralUser, prismaBase, prisma, type Db } from './prisma';

// ---- Types -------------------------------------------------------------------

export interface ReportMetric {
  key: string;
  label: string;
  value: number;
}

// Only REGISTRAR_ADMIN and DEAN may view accreditation reports (spec §2).
export const REPORT_VIEWER_ROLES = ['REGISTRAR_ADMIN', 'DEAN'];

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/** Passing threshold for a marks row (matches GradeBoundary D/F cut, spec §6). */
export const PASS_MARKS = 40;

/**
 * Pass rate = percent of marks rows with totalMarks >= PASS_MARKS.
 * Returns null when there are no published marks rows so the caller can OMIT the
 * metric entirely (never emit 0 for missing data).
 */
export function computePassRate(rows: Array<{ totalMarks: number }>): number | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const passed = rows.reduce((acc, r) => acc + (Number(r.totalMarks) >= PASS_MARKS ? 1 : 0), 0);
  return round2((passed / rows.length) * 100);
}

/**
 * Student–faculty ratio rounded to 2 decimal places. Returns null when either
 * input is absent/non-finite or faculty <= 0 (metric omitted, never 0).
 */
export function computeStudentFacultyRatio(students: number, faculty: number): number | null {
  const s = Number(students);
  const f = Number(faculty);
  if (!Number.isFinite(s) || !Number.isFinite(f) || s <= 0 || f <= 0) return null;
  return round2(s / f);
}

function pushMetric(
  metrics: ReportMetric[],
  key: string,
  label: string,
  value: number | null | undefined
): void {
  if (value !== undefined && value !== null) {
    metrics.push({ key, label, value });
  }
}

/**
 * NAAC institution-level metric composition (spec §4). Omitted:
 * - studentFacultyRatio when faculty is absent/0;
 * - passRate when no published marks rows exist for the year.
 */
export function aggregateNaac(input: {
  totalStudents?: number;
  totalFaculty?: number;
  programs?: number;
  courses?: number;
  passRate?: number | null;
}): ReportMetric[] {
  const metrics: ReportMetric[] = [];
  pushMetric(metrics, 'totalStudents', 'Total Students', input.totalStudents);
  pushMetric(metrics, 'totalFaculty', 'Total Faculty', input.totalFaculty);
  pushMetric(metrics, 'programs', 'Programs', input.programs);
  pushMetric(metrics, 'courses', 'Courses', input.courses);
  pushMetric(
    metrics,
    'studentFacultyRatio',
    'Student-Faculty Ratio',
    computeStudentFacultyRatio(input.totalStudents ?? 0, input.totalFaculty ?? 0)
  );
  pushMetric(metrics, 'passRate', 'Overall Pass Rate (%)', input.passRate);
  return metrics;
}

/**
 * NBA program-level metric composition (spec §4). Omitted:
 * - passRate when no PUBLISHED marks rows for the program/year;
 * - poAttainmentAvg when no OBE attainment data exists for the program/year.
 */
export function aggregateNba(input: {
  studentsInProgram?: number;
  courses?: number;
  passRate?: number | null;
  poAttainmentAvg?: number | null;
}): ReportMetric[] {
  const metrics: ReportMetric[] = [];
  pushMetric(metrics, 'studentsInProgram', 'Students in Program', input.studentsInProgram);
  pushMetric(metrics, 'courses', 'Courses', input.courses);
  pushMetric(metrics, 'passRate', 'Program Pass Rate (%)', input.passRate);
  pushMetric(metrics, 'poAttainmentAvg', 'Avg PO Attainment (%)', input.poAttainmentAvg);
  return metrics;
}

/** NIRF dashboard metric composition (spec §4). */
export function aggregateNirf(input: {
  studentStrength?: number;
  studentFacultyRatio?: number | null;
  graduationOutput?: number | null;
  programs?: number;
}): ReportMetric[] {
  const metrics: ReportMetric[] = [];
  pushMetric(metrics, 'studentStrength', 'Student Strength', input.studentStrength);
  pushMetric(metrics, 'studentFacultyRatio', 'Student-Faculty Ratio', input.studentFacultyRatio);
  pushMetric(metrics, 'graduationOutput', 'Graduation Output (%)', input.graduationOutput);
  pushMetric(metrics, 'programs', 'Programs', input.programs);
  return metrics;
}

// ---- Access / input guards ----------------------------------------------------

/** Throws 403 when the user is not a report viewer (REGISTRAR_ADMIN/DEAN). */
export function assertReportViewer(user: AuthPayload): void {
  if (!REPORT_VIEWER_ROLES.includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Registrar admin or dean access required');
  }
}

/** Requires a non-empty academicYear query param (400 when missing). */
export function requireAcademicYear(url: URL): string {
  const academicYear = url.searchParams.get('academicYear');
  if (!academicYear || !academicYear.trim()) {
    throw new ApiError(400, 'MISSING_ACADEMIC_YEAR', 'academicYear query parameter is required');
  }
  return academicYear.trim();
}

// ---- Tenant scope resolution ---------------------------------------------------

/**
 * Resolves the concrete reporting scope for a request.
 * - school-scoped user -> extended (tenant-scoped) client + their own schoolId.
 * - central 'ALL' user  -> base client + schoolId from query (400 if missing,
 *   validated against the School table => 400 if unknown). All counts are then
 *   scoped to that schoolId.
 */
export async function resolveReportScope(
  request: Request,
  user: AuthPayload
): Promise<{ db: Db; schoolId: string }> {
  if (!isCentralUser(user)) {
    return { db: prisma as unknown as Db, schoolId: user.schoolId };
  }
  const url = new URL(request.url);
  const schoolId = url.searchParams.get('schoolId');
  if (!schoolId || !schoolId.trim()) {
    throw new ApiError(400, 'SCHOOL_ID_REQUIRED', 'Central officers must specify a schoolId');
  }
  const school = await prismaBase.school.findUnique({
    where: { id: schoolId.trim() },
    select: { id: true },
  });
  if (!school) {
    throw new ApiError(400, 'INVALID_SCHOOL_ID', 'Unknown schoolId');
  }
  return { db: prismaBase, schoolId: schoolId.trim() };
}

// ---- DB helpers for metric sources -------------------------------------------

/**
 * Loads the `totalMarks` rows of all PUBLISHED exams for the tenant/year
 * (optionally restricted to a program). Returns [] when there are no PUBLISHED
 * exams -> passRate becomes null and the metric is omitted.
 */
export async function loadPublishedMarksRows(
  db: Db,
  opts: { schoolId: string; academicYear: string; programId?: string }
): Promise<Array<{ totalMarks: number }>> {
  const examWhere = {
    schoolId: opts.schoolId,
    academicYear: opts.academicYear,
    status: 'PUBLISHED',
    ...(opts.programId ? { programId: opts.programId } : {}),
  };
  if (opts.programId) examWhere.programId = opts.programId;

  const exams = await db.exam.findMany({ where: examWhere, select: { id: true } });
  if (exams.length === 0) return [];

  const ids = exams.map((e) => e.id);
  return db.marksEntry.findMany({
    where: { schoolId: opts.schoolId, examId: { in: ids } },
    select: { totalMarks: true },
  });
}

/**
 * Average CO attainment for a program in a year, rounded to 2dp. Null when the
 * program has no courses or no OBE attainment data for the year (metric omitted).
 */
export async function computeProgramPOAttainmentAvg(
  db: Db,
  opts: { schoolId: string; academicYear: string; programId: string }
): Promise<number | null> {
  const courseIds = (
    await db.course.findMany({
      where: { schoolId: opts.schoolId, programId: opts.programId },
      select: { id: true },
    })
  ).map((c) => c.id);

  if (courseIds.length === 0) return null;

  const agg = await db.cOAttainment.aggregate({
    where: {
      schoolId: opts.schoolId,
      academicYear: opts.academicYear,
      courseId: { in: courseIds },
    },
    _avg: { attainment: true },
  });

  const avg = agg._avg?.attainment as number | null;
  return avg == null ? null : round2(Number(avg));
}
