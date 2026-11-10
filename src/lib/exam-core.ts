// ==============================================================================
// Examination & Result module (Module 4) — backend business logic.
// Pure functions (total marks, grade, hall-ticket number builder, result math)
// live here so the tester can unit-test them without a database. Thin DB helpers
// (tenant resolution from an exam, course ownership assert, sequence) are used
// by the API routes.
//
// Multi-tenant model:
//   - school-scoped users use the extended client (auto-injects schoolId);
//   - central 'ALL' controllers use the base client and resolve a tenant from
//     the target exam resource (or via body.schoolId on creates).
// ==============================================================================

import { ApiError } from './errors';
import { getNextSequence } from './fee-core';
import type { Db } from './prisma';

export { resolveCreateTenant } from './fee-core';

// ---- Pure helpers (unit-tested) ----------------------------------------------

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Total marks = internal + external, rounded to 2 decimal places (float-safe).
 */
export function computeTotalMarks(internal: number, external: number): number {
  return round2((Number(internal) || 0) + (Number(external) || 0));
}

/**
 * Grade from a percentage (0-100). Boundaries per spec §6.2:
 *   90+ -> A+, 80+ -> A, 70+ -> B+, 60+ -> B, 50+ -> C, 40+ -> D, <40 -> F.
 * The upper bound is inclusive: 90 exactly -> A+, 89.9 -> A.
 */
export function computeGradeForPercentage(pct: number): string {
  const p = Number(pct);
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C';
  if (p >= 40) return 'D';
  return 'F';
}

/**
 * Grade for a single marks entry from its total against the exam's maxes.
 * Percentage = total / (maxInternal + maxExternal) * 100, rounded to 2 decimals.
 */
export function computeGradeForMarks(
  totalMarks: number,
  maxInternal: number,
  maxExternal: number
): string {
  const max = (Number(maxInternal) || 0) + (Number(maxExternal) || 0);
  const pct = max > 0 ? round2((Number(totalMarks) / max) * 100) : 0;
  return computeGradeForPercentage(pct);
}

/**
 * Hall ticket number builder: `HT-{YYYY}-{6-digit seq}`.
 */
export function buildHallTicketNo(seq: number, year: string | number): string {
  const n = String(Math.max(1, Math.floor(Number(seq) || 1))).padStart(6, '0');
  return `HT-${year}-${n}`;
}

export interface ResultTotalsInput {
  totalSecured: number;
  totalMax: number;
}

export interface ResultTotalsOutput {
  totalSecured: number;
  totalMax: number;
  percentage: number;
  grade: string;
}

/**
 * Per-student aggregate result math. `totalSecured` is the sum of the student's
 * marks across their schedules and `totalMax` the corresponding max possible
 * (schedules-with-marks x (maxInternal + maxExternal)). Percentage is rounded to
 * 2 decimals before grading.
 */
export function computeResultTotals(input: ResultTotalsInput): ResultTotalsOutput {
  const totalSecured = round2(Number(input.totalSecured) || 0);
  const totalMax = round2(Number(input.totalMax) || 0);
  const percentage = totalMax > 0 ? round2((totalSecured / totalMax) * 100) : 0;
  return { totalSecured, totalMax, percentage, grade: computeGradeForPercentage(percentage) };
}

// ---- Thin DB helpers ----------------------------------------------------------

/**
 * Loads an exam by id and validates it exists (404). Used to resolve the tenant
 * for exam-scoped writes — especially for central 'ALL' controllers, where the
 * tenant is derived from the exam resource itself rather than a body field.
 */
export async function loadExam(db: Db, examId: string) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      schoolId: true,
      programId: true,
      academicYear: true,
      semester: true,
      type: true,
      title: true,
      maxInternal: true,
      maxExternal: true,
      status: true,
      publishedAt: true,
    },
  });
  if (!exam) {
    throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
  }
  return exam;
}

/**
 * Loads a course and asserts it belongs to `schoolId` (404 / 400).
 */
export async function assertCourseBelongsToSchool(
  db: Db,
  courseId: string,
  schoolId: string
) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, schoolId: true, programId: true, code: true, title: true },
  });
  if (!course) {
    throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  }
  if (course.schoolId !== schoolId) {
    throw new ApiError(400, 'SCHOOL_MISMATCH', 'Course does not belong to this school');
  }
  return course;
}

/**
 * Loads a schedule, verifies it belongs to `examId` and returns it (404).
 * Works for both clients: the per-school client is auto-scoped; the central base
 * client is scoped by examId (globally unique).
 */
export async function loadScheduleForExam(db: Db, examId: string, scheduleId: string) {
  const schedule = await db.examSchedule.findFirst({
    where: { id: scheduleId, examId },
    select: {
      id: true,
      schoolId: true,
      examId: true,
      courseId: true,
      examDate: true,
      startTime: true,
      venue: true,
    },
  });
  if (!schedule) {
    throw new ApiError(404, 'NOT_FOUND', 'Schedule not found for this exam');
  }
  return schedule;
}

export { getNextSequence };
