// ==============================================================================
// Attendance module (Module 7) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/attendance*` endpoints
// (docs/specs/attendance.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `POST /api/attendance/mark` → `201 { marked: number }`
//   2. `GET /api/attendance/report?courseId=&studentId=&schoolId=`
//          → `200 AttendanceRecordRow[]`
//   3. `GET /api/attendance/defaulter?courseId=&threshold=&schoolId=`
//          → `200 AttendanceRecordRow[]`
// ==============================================================================

import type { UserRole } from "@/types";
import { downloadCsv, toCsv } from "@/lib/obe";

// ---- Types (shapes the backend returns) --------------------------------------

export type AttendanceStatus = "PRESENT" | "ABSENT";

/**
 * Row shape returned by both `GET /api/attendance/report` and
 * `GET /api/attendance/defaulter`. `percentage` is `round(present / totalDays * 100, 2)`.
 */
export interface AttendanceRecordRow {
  studentId: string;
  rollNo: string;
  name: string;
  totalDays: number;
  presentDays: number;
  percentage: number;
}

// ---- Request bodies / filter shapes ------------------------------------------

/** Body for `POST /api/attendance/mark`. `schoolId` required only for Central officers. */
export interface MarkAttendanceInput {
  schoolId?: string;
  courseId: string;
  /** Date in `YYYY-MM-DD` form. */
  date: string;
  records: { studentId: string; status: AttendanceStatus }[];
}

/** Filters for `GET /api/attendance/report`. */
export interface AttendanceReportFilters {
  courseId: string;
  studentId?: string;
  schoolId?: string;
}

/** Filters for `GET /api/attendance/defaulter`. */
export interface DefaulterFilters {
  courseId: string;
  threshold: number;
  schoolId?: string;
}

// ---- Drill-down (per-student day view + per-teacher "Marked by") ------------

/** One day in a student's drill-down view. */
export interface AttendanceDayRow {
  recordId: string;
  /** `YYYY-MM-DD` */
  date: string;
  status: AttendanceStatus;
  markedById: string | null;
  teacherName: string | null;
}

/** Per-teacher summary: which dates they marked. */
export interface AttendanceTeacherSummary {
  teacherId: string;
  teacherName: string;
  markedCount: number;
  dates: string[];
}

/** Response of `GET /api/attendance/detail`. */
export interface AttendanceDetail {
  student: { studentId: string; rollNo: string; name: string } | null;
  days: AttendanceDayRow[];
  teachers: AttendanceTeacherSummary[];
}

/** Filters for `GET /api/attendance/detail`. */
export interface AttendanceDetailFilters {
  courseId: string;
  studentId?: string;
  schoolId?: string;
  teacherId?: string;
}

/** Body for `POST /api/attendance/update`. */
export interface UpdateAttendanceInput {
  schoolId?: string;
  courseId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
}

// ---- Role helpers -------------------------------------------------------------

/** Roles permitted to open the `/attendance` screens. */
export const ATTENDANCE_PERMITTED_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FACULTY",
  "DEAN",
  "REGISTRAR_ADMIN",
  "STUDENT",
];

/** A user may use the attendance module if they hold one of the permitted roles. */
export function canAccessAttendance(role?: UserRole): boolean {
  return !!role && ATTENDANCE_PERMITTED_ROLES.includes(role);
}

/** Only Faculty may mark attendance. */
export function canMarkAttendance(role?: UserRole): boolean {
  return role === "FACULTY" || role === "SUPER_ADMIN";
}

/** Dean / Registrar / Faculty may view the defaulter list. */
export function canViewDefaulter(role?: UserRole): boolean {
  return role === "FACULTY" || role === "DEAN" || role === "REGISTRAR_ADMIN" || role === "SUPER_ADMIN";
}

// ---- Pure business rules (spec §6 + acceptance criteria) ----------------------

/**
 * Attendance percentage per spec: `round(present / totalDays * 100, 2)`.
 * Returns `null` when `totalDays` is 0 (those rows are omitted).
 */
export function calculateAttendancePercentage(
  totalDays: number,
  presentDays: number
): number | null {
  if (!Number.isFinite(totalDays) || !Number.isFinite(presentDays)) return null;
  if (totalDays <= 0) return null;
  const pct = (presentDays / totalDays) * 100;
  return Math.round(pct * 100) / 100;
}

// ---- Error contract ------------------------------------------------------------

export interface AttendanceApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class AttendanceApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "AttendanceApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<AttendanceApiError> {
  let message = `Request failed with status ${res.status}`;
  let code: string | undefined;
  let details: unknown;
  try {
    const body = (await res.json()) as AttendanceApiErrorBody;
    if (body?.error?.message) message = body.error.message;
    code = body?.error?.code;
    details = body?.error?.details;
  } catch {
    /* no json body */
  }
  return new AttendanceApiError(res.status, message, code, details);
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

// ---- Endpoint wrappers (one per frozen contract endpoint) -----------------------

/** `POST /api/attendance/mark` (FACULTY) → `201 { marked }`. */
export function markAttendance(input: MarkAttendanceInput): Promise<{ marked: number }> {
  return request("/api/attendance/mark", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `GET /api/attendance/report?courseId=&studentId=&schoolId=` → rows. */
export function fetchAttendanceReport(filters: AttendanceReportFilters): Promise<AttendanceRecordRow[]> {
  const p = new URLSearchParams({ courseId: filters.courseId });
  if (filters.studentId) p.set("studentId", filters.studentId);
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  return request(`/api/attendance/report?${p.toString()}`);
}

/** `GET /api/attendance/defaulter?courseId=&threshold=&schoolId=` → rows. */
export function fetchDefaulter(filters: DefaulterFilters): Promise<AttendanceRecordRow[]> {
  const p = new URLSearchParams({
    courseId: filters.courseId,
    threshold: String(filters.threshold),
  });
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  return request(`/api/attendance/defaulter?${p.toString()}`);
}

/** `GET /api/attendance/detail?courseId=&studentId=&schoolId=&teacherId=` → detail. */
export function fetchAttendanceDetail(filters: AttendanceDetailFilters): Promise<AttendanceDetail> {
  const p = new URLSearchParams({ courseId: filters.courseId });
  if (filters.studentId) p.set("studentId", filters.studentId);
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  if (filters.teacherId) p.set("teacherId", filters.teacherId);
  return request(`/api/attendance/detail?${p.toString()}`);
}

/** `POST /api/attendance/update` (FACULTY) → updated record. */
export function updateAttendanceRecord(
  input: UpdateAttendanceInput
): Promise<{ updated: true; record: AttendanceDayRow }> {
  return request("/api/attendance/update", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---- CSV helpers (re-exported for consistency) ---------------------------------

export { toCsv, downloadCsv };
