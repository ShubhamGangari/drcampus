// ==============================================================================
// Student Lifecycle module (Module 2) — backend business logic.
// Pure functions (rollNo generation, enrollment-duplicate detection, graduate
// eligibility) live here so the tester can unit-test them without a database.
// The self-student resolver and history builder are thin DB helpers used by the
// API routes.
// ==============================================================================

import type { AuthPayload } from './auth';
import { isCentralUser, type Db } from './prisma';
import { ApiError } from './errors';

export const STUDENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'GRADUATED', 'DROPPED', 'TRANSFERRED'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Deterministic roll-number builder. `seq` is the per-program sequence number
 * (1-based). Rolls are formatted as `${programCode}-NNNN`.
 */
export function buildRollNo(programCode: string, seq: number): string {
  const n = Math.max(1, Math.floor(Number(seq) || 1));
  return `${programCode}-${String(n).padStart(4, '0')}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pure helper: computes the next free roll-number suffix for a program from a
 * list of existing rollNos. Parses the numeric suffix of every rollNo matching
 * `${programCode}-NNNN` and returns maxSuffix + 1 (1 when nothing matches).
 * This is collision-proof against seed rows that have gaps or share the
 * pattern — it never relies on COUNT (which races under concurrency and
 * ignores per-school scoping).
 */
export function computeNextRollNo(programCode: string, existingRollNos: readonly string[]): string {
  const prefix = `${programCode}-`;
  const re = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
  let max = 0;
  for (const rollNo of existingRollNos) {
    const m = re.exec(rollNo);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return buildRollNo(programCode, max + 1);
}

export interface EnrollmentKey {
  academicYear: string;
  semester: number;
}

/**
 * Duplicate-enrollment detection. Returns the existing enrollment when a row
 * already exists for the same (studentId handled by caller, academicYear,
 * semester) triple; returns `undefined` when the combination is new.
 */
export function findDuplicateEnrollment(
  enrollments: readonly EnrollmentKey[],
  academicYear: string,
  semester: number
): EnrollmentKey | undefined {
  return enrollments.find(
    (e) => e.academicYear === academicYear && Number(e.semester) === Number(semester)
  );
}

export interface GraduateCandidate {
  status: string;
}

/**
 * Graduate-eligibility predicate: only an ACTIVE student who has at least one
 * enrollment and is not already GRADUATED may be graduated.
 */
export function isGraduateEligible(student: GraduateCandidate, hasEnrollment: boolean): boolean {
  return student.status === 'ACTIVE' && hasEnrollment;
}

/**
 * Whether a student may be enrolled for a new academic year/semester.
 * Graduated and dropped students are terminal states and cannot be enrolled.
 */
export function canEnrollStudent(status: string): boolean {
  return status !== 'GRADUATED' && status !== 'DROPPED';
}

export interface LeaveRange {
  fromDate: string;
  toDate: string;
}

/**
 * Overlap detection for leave date ranges (ISO `YYYY-MM-DD` strings, so plain
 * string comparison is safe). Two ranges overlap when each starts before the
 * other ends: `a.fromDate <= b.toDate && a.toDate >= b.fromDate`.
 */
export function hasLeaveOverlap(
  leaves: readonly LeaveRange[],
  fromDate: string,
  toDate: string
): boolean {
  return leaves.some((l) => l.fromDate <= toDate && l.toDate >= fromDate);
}

/**
 * Batch/program integrity: a batch may only be used to create a student in the
 * exact program it belongs to. Returns `true` when the pairing is inconsistent.
 */
export function isBatchProgramMismatch(batchProgramId: string, programId: string): boolean {
  return batchProgramId !== programId;
}

// ---- DB helpers (used by routes) --------------------------------------------

/**
 * Resolves the logged-in user's own Student record, if one exists. The only
 * stable link between a User account and a Student row is the email address
 * (both are unique per school).
 */
export async function findSelfStudent(db: Db, user: AuthPayload) {
  const u = await db.user.findUnique({
    where: { id: user.userId },
    select: { email: true },
  });
  if (!u?.email) return null;
  return db.student.findFirst({ where: { email: u.email } });
}

/**
 * Resolves the concrete schoolId that a create-style write must use.
 * - School-scoped users always write to their own school; any body schoolId is
 *   ignored so a non-central user can never write into another tenant.
 * - Central officers (schoolId === 'ALL') must specify a target schoolId in the
 *   request body; when absent, SCHOOL_ID_REQUIRED (400) is thrown.
 */
export function resolveCreateTenant(user: { schoolId: string }, bodySchoolId?: string): string {
  if (!isCentralUser(user)) {
    return user.schoolId;
  }
  if (!bodySchoolId) {
    throw new ApiError(400, 'SCHOOL_ID_REQUIRED', 'Central officers must specify a schoolId');
  }
  return bodySchoolId;
}

/**
 * Loads a student and asserts it belongs to `schoolId`. Throws 404 when the
 * student does not exist and 400 SCHOOL_MISMATCH when it belongs to another
 * school. Returns the student row.
 */
export async function assertStudentBelongsToSchool(db: Db, studentId: string, schoolId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true },
  });
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Student not found');
  }
  if (student.schoolId !== schoolId) {
    throw new ApiError(400, 'SCHOOL_MISMATCH', 'Student does not belong to the specified school');
  }
  return student;
}

/**
 * Generates a unique roll number for a new student in the given program+school.
 * Scoped to the school (so rollNos are unique per-school, not globally) and
 * collision-proof (parses existing rollNos to find gaps, never uses COUNT).
 *
 * @param db Prisma client (scoped to the user's school)
 * @param program The program (must have code and belong to schoolId)
 * @param schoolId The concrete schoolId (not 'ALL')
 * @returns A unique rollNo like `${program.code}-0001`
 */
export async function generateRollNo(
  db: Db,
  program: { id: string; code: string },
  schoolId: string
): Promise<string> {
  const existing = await db.student.findMany({
    where: { programId: program.id, schoolId },
    select: { rollNo: true },
  });
  return computeNextRollNo(program.code, existing.map((s) => s.rollNo));
}

interface StudentHistorySource {
  id: string;
  admissionDate?: string | Date | null;
  enrollments?: Array<{
    id: string;
    academicYear: string;
    semester: number | string;
    createdAt?: string | Date | null;
  }>;
  leaveRequests?: Array<{
    id: string;
    status: string;
    type: string;
    requestedAt?: string | Date | null;
  }>;
  transferRequests?: Array<{
    id: string;
    status: string;
    toProgramId: string;
    requestedAt?: string | Date | null;
  }>;
}

/**
 * Builds a chronological student timeline from real records (admission,
 * enrollments, leave/transfer requests). Returns an empty array when a student
 * has no recorded events — it never fabricates data.
 */
export function buildStudentHistory(student: StudentHistorySource): Array<{ id: string; event: string; detail: string; date: string }> {
  const entries: Array<{ id: string; event: string; detail: string; date: string }> = [];

  if (student.admissionDate) {
    entries.push({
      id: `adm-${student.id}`,
      event: 'Admitted',
      detail: 'Student admitted to program',
      date: new Date(student.admissionDate).toISOString(),
    });
  }

  for (const e of student.enrollments ?? []) {
    entries.push({
      id: e.id,
      event: 'Enrolled',
      detail: `${e.academicYear} · Sem ${e.semester}`,
      date: e.createdAt ? new Date(e.createdAt).toISOString() : '',
    });
  }

  for (const l of student.leaveRequests ?? []) {
    entries.push({
      id: l.id,
      event: `Leave ${l.status}`,
      detail: l.type,
      date: l.requestedAt ? new Date(l.requestedAt).toISOString() : '',
    });
  }

  for (const t of student.transferRequests ?? []) {
    entries.push({
      id: t.id,
      event: `Transfer ${t.status}`,
      detail: `To program ${t.toProgramId}`,
      date: t.requestedAt ? new Date(t.requestedAt).toISOString() : '',
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
