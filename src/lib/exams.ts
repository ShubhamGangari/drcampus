// ==============================================================================
// Examination & Result module (Module 4) — typed frontend API client.
// Mirrors the FROZEN contract for the `/api/exams*` endpoints (docs/specs/
// examination-result.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `POST /api/exams`                    → `201 { examId }`
//   2. `GET /api/exams`                     → `200 Exam[]` (filters in query)
//   3. `GET /api/exams/[id]`                → `200 ExamDetail`
//   4. `POST /api/exams/[id]/schedules`     → `201 { scheduleId }`
//   5. `PUT /api/exams/[id]/schedules/[scheduleId]` → `200 ScheduleWriteResult`
//   6. `GET /api/exams/[id]/schedules`      → `200 ExamSchedule[]`
//   7. `POST /api/exams/[id]/hall-tickets/generate` → `201 { hallTicketId, hallTicketNo }`
//   8. `GET /api/exams/[id]/hall-tickets`   → `200 HallTicket[]`
//   9. `POST /api/exams/[id]/marks`         → `201 { marksId, totalMarks, grade }`
//  10. `GET /api/exams/[id]/marks`          → `200 MarksEntry[]`
//  11. `POST /api/exams/[id]/results/publish`   → `200 { published, publishedAt }`
//  12. `POST /api/exams/[id]/results/unpublish` → `200 { published }`
//  13. `GET /api/exams/[id]/results`        → `200 ResultRow[]`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type ExamType = "MID_SEM" | "END_SEM";
export type ExamStatus = "DRAFT" | "SCHEDULED" | "COMPLETED" | "PUBLISHED";

/** Row shape returned by `GET /api/exams`. */
export interface Exam {
  id: string;
  programId: string;
  academicYear: string;
  semester: number;
  type: ExamType;
  title: string;
  maxInternal: number;
  maxExternal: number;
  status: ExamStatus;
}

/** Shape returned by `GET /api/exams/[id]` (exam + its schedules). */
export interface ExamDetail extends Exam {
  schedules: ExamSchedule[];
}

/** Row shape returned by `GET /api/exams/[id]/schedules`. */
export interface ExamSchedule {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  examDate: string;
  startTime: string;
  venue: string;
}

/** Shape returned by `PUT /api/exams/[id]/schedules/[scheduleId]`. */
export interface ScheduleWriteResult {
  scheduleId: string;
  courseId: string;
  examDate: string;
  startTime: string;
  venue: string;
}

/** Row shape returned by `GET /api/exams/[id]/hall-tickets`. */
export interface HallTicket {
  id: string;
  studentId: string;
  hallTicketNo: string;
  createdAt: string;
}

/** Row shape returned by `GET /api/exams/[id]/marks`. */
export interface MarksEntry {
  id: string;
  studentId: string;
  scheduleId: string;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  grade: string | null;
  status: string;
}

/** Row shape returned by `GET /api/exams/[id]/results`. */
export interface ResultRow {
  studentId: string;
  rollNo: string;
  name: string;
  totalSecured: number;
  totalMax: number;
  percentage: number;
  grade: string;
  status: ExamStatus | string;
}

// ---- Request bodies -----------------------------------------------------------

export interface CreateExamInput {
  programId: string;
  academicYear: string;
  semester: number;
  type: ExamType;
  title: string;
  maxInternal: number;
  maxExternal: number;
  /** Required for Central officers (schoolId "ALL"); ignored for school-scoped users. */
  schoolId?: string;
}

export interface AddScheduleInput {
  courseId: string;
  examDate: string;
  startTime: string;
  venue: string;
}

export type UpdateScheduleInput = Partial<Pick<AddScheduleInput, "examDate" | "startTime" | "venue">>;

export interface SaveMarksInput {
  studentId: string;
  scheduleId: string;
  internalMarks: number;
  externalMarks: number;
}

// ---- Filter shapes ------------------------------------------------------------

export interface ExamFilters {
  programId?: string;
  academicYear?: string;
  status?: ExamStatus | "";
}

export interface MarksFilters {
  scheduleId?: string;
  studentId?: string;
}

// ---- Dropdown option sets -----------------------------------------------------

export const EXAM_TYPE_OPTIONS: { value: ExamType; label: string }[] = [
  { value: "MID_SEM", label: "Mid Semester" },
  { value: "END_SEM", label: "End Semester" },
];

export const EXAM_STATUS_OPTIONS: { value: ExamStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PUBLISHED", label: "Published" },
];

export const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

// ---- Role helpers -------------------------------------------------------------

export function isExamRole(role?: UserRole): boolean {
  // "Exam Controller" per the frozen contract === the EXAM_CONTROLLER role.
  return role === "EXAM_CONTROLLER";
}

export function isFacultyRole(role?: UserRole): boolean {
  return role === "FACULTY";
}

/** True when the user may enter/save marks (faculty or exam controller). */
export function canEnterMarks(role?: UserRole): boolean {
  return isExamRole(role) || isFacultyRole(role);
}

// ---- Pure business rules (spec §6.1–§6.2) ------------------------------------

/**
 * Pure helper: total marks = internal + external, rounded to 2 decimals.
 */
export function computeTotalMarks(internalMarks: number, externalMarks: number): number {
  const total = (Number(internalMarks) || 0) + (Number(externalMarks) || 0);
  return Math.round(total * 100) / 100;
}

/**
 * Pure helper: grade from percentage (spec §6.2).
 * 90+ → A+ (CGPA 10), 80+ → A (9), 70+ → B+ (8), 60+ → B (7),
 * 50+ → C (6), 40+ → D (5), <40 → F (0, not passed).
 */
export function computeGradeForPercentage(percentage: number): string {
  const p = Number(percentage) || 0;
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 70) return "B+";
  if (p >= 60) return "B";
  if (p >= 50) return "C";
  if (p >= 40) return "D";
  return "F";
}

// ---- Labels -------------------------------------------------------------------

export function examTypeLabel(type: ExamType): string {
  return type === "MID_SEM" ? "Mid Semester" : "End Semester";
}

export function examStatusLabel(status: ExamStatus | string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SCHEDULED":
      return "Scheduled";
    case "COMPLETED":
      return "Completed";
    case "PUBLISHED":
      return "Published";
    default:
      return String(status);
  }
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ---- Error contract -----------------------------------------------------------

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ExamsApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ExamsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<ExamsApiError> {
  let message = `Request failed with status ${res.status}`;
  let code: string | undefined;
  let details: unknown;
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error?.message) message = body.error.message;
    code = body?.error?.code;
    details = body?.error?.details;
  } catch {
    /* no json body */
  }
  return new ExamsApiError(res.status, message, code, details);
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// ---- Endpoint fetchers (pack §4) ---------------------------------------------

/** `POST /api/exams` — create an exam (EXAM_CONTROLLER). */
export function createExam(input: CreateExamInput): Promise<{ examId: string }> {
  return request<{ examId: string }>("/api/exams", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `GET /api/exams` — list exams. */
export function fetchExams(filters: ExamFilters = {}): Promise<Exam[]> {
  return request<Exam[]>(
    `/api/exams${buildQuery({
      programId: filters.programId,
      academicYear: filters.academicYear,
      status: filters.status,
    })}`,
    { method: "GET" }
  );
}

/** `GET /api/exams/[id]` — exam detail + its schedules. */
export function fetchExam(examId: string): Promise<ExamDetail> {
  return request<ExamDetail>(`/api/exams/${encodeURIComponent(examId)}`, { method: "GET" });
}

// ---- Schedules ----------------------------------------------------------------

/** `POST /api/exams/[id]/schedules` — add a course schedule (EXAM_CONTROLLER). */
export function addSchedule(examId: string, input: AddScheduleInput): Promise<{ scheduleId: string }> {
  return request<{ scheduleId: string }>(`/api/exams/${encodeURIComponent(examId)}/schedules`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `PUT /api/exams/[id]/schedules/[scheduleId]` — edit a schedule (EXAM_CONTROLLER). */
export function updateSchedule(
  examId: string,
  scheduleId: string,
  input: UpdateScheduleInput
): Promise<ScheduleWriteResult> {
  return request<ScheduleWriteResult>(
    `/api/exams/${encodeURIComponent(examId)}/schedules/${encodeURIComponent(scheduleId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}

/** `GET /api/exams/[id]/schedules` — list schedules. */
export function fetchSchedules(examId: string): Promise<ExamSchedule[]> {
  return request<ExamSchedule[]>(`/api/exams/${encodeURIComponent(examId)}/schedules`, { method: "GET" });
}

// ---- Hall tickets --------------------------------------------------------------

/** `POST /api/exams/[id]/hall-tickets/generate` — generate for a student (EXAM_CONTROLLER). */
export function generateHallTicket(
  examId: string,
  studentId: string
): Promise<{ hallTicketId: string; hallTicketNo: string }> {
  return request<{ hallTicketId: string; hallTicketNo: string }>(
    `/api/exams/${encodeURIComponent(examId)}/hall-tickets/generate`,
    {
      method: "POST",
      body: JSON.stringify({ studentId }),
    }
  );
}

/** `GET /api/exams/[id]/hall-tickets` — list tickets. */
export function fetchHallTickets(examId: string): Promise<HallTicket[]> {
  return request<HallTicket[]>(`/api/exams/${encodeURIComponent(examId)}/hall-tickets`, { method: "GET" });
}

// ---- Marks --------------------------------------------------------------------

/** `POST /api/exams/[id]/marks` — enter/update marks for a student+course. */
export function saveMarks(
  examId: string,
  input: SaveMarksInput
): Promise<{ marksId: string; totalMarks: number; grade: string }> {
  return request<{ marksId: string; totalMarks: number; grade: string }>(
    `/api/exams/${encodeURIComponent(examId)}/marks`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

/** `GET /api/exams/[id]/marks` — list marks. */
export function fetchMarks(examId: string, filters: MarksFilters = {}): Promise<MarksEntry[]> {
  return request<MarksEntry[]>(
    `/api/exams/${encodeURIComponent(examId)}/marks${buildQuery({
      scheduleId: filters.scheduleId,
      studentId: filters.studentId,
    })}`,
    { method: "GET" }
  );
}

// ---- Results ------------------------------------------------------------------

/** `POST /api/exams/[id]/results/publish` — publish results (EXAM_CONTROLLER). */
export function publishResults(examId: string): Promise<{ published: boolean; publishedAt: string }> {
  return request<{ published: boolean; publishedAt: string }>(
    `/api/exams/${encodeURIComponent(examId)}/results/publish`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

/** `POST /api/exams/[id]/results/unpublish` — unpublish results (EXAM_CONTROLLER). */
export function unpublishResults(examId: string): Promise<{ published: boolean }> {
  return request<{ published: boolean }>(
    `/api/exams/${encodeURIComponent(examId)}/results/unpublish`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

/** `GET /api/exams/[id]/results` — result list. */
export function fetchResults(examId: string): Promise<ResultRow[]> {
  return request<ResultRow[]>(`/api/exams/${encodeURIComponent(examId)}/results`, { method: "GET" });
}
