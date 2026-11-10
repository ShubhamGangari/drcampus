// ==============================================================================
// Student Lifecycle module (Module 2) — typed frontend API client.
// Mirrors the FROZEN contract for the `/api/students*` endpoints. All auth-bearing
// calls rely on the HttpOnly `auth_token` cookie set by the portal login route, so
// `fetch` here is same-origin without manual headers.
//
// The backend routes for this module may not exist yet — this client is typed to
// the contract so the UI compiles regardless of backend build state. API calls are
// made at runtime only.
// ==============================================================================

import { PROGRAMS } from "@/data/mockData";
import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type StudentStatus = "ACTIVE" | "ON_LEAVE" | "GRADUATED" | "DROPPED" | "TRANSFERRED";

export type RequestReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Row shape returned by `GET /api/students` (list). */
export interface StudentSummary {
  id: string;
  rollNo: string;
  firstName: string;
  lastName: string;
  email: string;
  programId: string;
  batchId: string;
  status: StudentStatus;
}

export interface Enrollment {
  id: string;
  academicYear: string;
  semester: number;
  status: string;
}

export interface LeaveRequest {
  id: string;
  type: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: RequestReviewStatus;
  remarks?: string;
  requestedAt: string;
}

export interface TransferRequest {
  id: string;
  toProgramId: string;
  reason: string;
  status: RequestReviewStatus;
  remarks?: string;
  requestedAt: string;
}

export interface StudentHistoryEntry {
  id: string;
  event: string;
  detail: string;
  date: string;
}

/** Full shape returned by `GET /api/students/[id]`. */
export interface StudentDetail extends StudentSummary {
  phone: string;
  dob: string;
  gender: string;
  category: string;
  admissionDate: string;
  enrollments: Enrollment[];
  leaveRequests: LeaveRequest[];
  transferRequests: TransferRequest[];
  history: StudentHistoryEntry[];
}

/**
 * Row shape for the admin Leaves / Transfers screens. The contract exposes these
 * as bare arrays (`GET /api/students/leaves`, `GET /api/students/transfers`); the
 * row shape below carries the student snapshot the table needs to render.
 */
export interface LeaveRequestRecord extends LeaveRequest {
  studentId: string;
  student?: { id: string; rollNo: string; firstName: string; lastName: string };
}

export interface TransferRequestRecord extends TransferRequest {
  studentId: string;
  fromProgramId: string;
  student?: { id: string; rollNo: string; firstName: string; lastName: string };
}

// ---- Request bodies -----------------------------------------------------------

export interface CreateStudentInput {
  admissionId?: string;
  programId: string;
  batchId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  category: string;
}

export type UpdateStudentInput = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: StudentStatus;
}>;

export interface EnrollStudentInput {
  academicYear: string;
  semester: number;
}

export interface LeaveRequestInput {
  type: string;
  fromDate: string;
  toDate: string;
  reason: string;
}

export interface TransferRequestInput {
  toProgramId: string;
  reason: string;
}

export interface ReviewRequestInput {
  status: "APPROVED" | "REJECTED";
  remarks?: string;
}

export interface StudentFilters {
  programId?: string;
  batchId?: string;
  status?: StudentStatus | "";
  search?: string;
}

// ---- Options used by dropdowns -------------------------------------------------

export interface ProgramOption {
  id: string;
  name: string;
  code: string;
}

export interface BatchOption {
  id: string;
  name: string;
  academicYear: string;
  programId: string;
}

export interface BatchFilters {
  programId?: string;
}

/**
 * Program options for dropdowns — derived from the real in-app program catalogue
 * (same source the Admissions screens use), not placeholder data.
 */
export const PROGRAM_OPTIONS: ProgramOption[] = PROGRAMS.map((p) => ({
  id: p.id,
  name: p.name,
  code: p.code,
}));

export const STUDENT_STATUS_OPTIONS: { value: StudentStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "DROPPED", label: "Dropped" },
];

export const GENDER_OPTIONS = ["Male", "Female", "Other"];
export const CATEGORY_OPTIONS = ["General", "OBC", "SC", "ST", "EWS"];
export const LEAVE_TYPE_OPTIONS = ["Medical", "Personal", "Emergency", "Vacation"];

// ---- Helpers ------------------------------------------------------------------

export function isAdminRole(role?: UserRole): boolean {
  // Super admin and Registrar Admin act as the administrative roles on student pages.
  return role === "SUPER_ADMIN" || role === "REGISTRAR_ADMIN";
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fullName(s: { firstName: string; lastName: string }): string {
  return `${s.firstName} ${s.lastName}`.trim();
}

export function programCode(programId: string): string {
  return PROGRAM_OPTIONS.find((p) => p.id === programId)?.code ?? programId;
}

export function programName(programId: string): string {
  return PROGRAM_OPTIONS.find((p) => p.id === programId)?.name ?? programId;
}

export function batchLabel(batchId: string, batches: BatchOption[] = []): string {
  return batches.find((b) => b.id === batchId)?.name ?? batchId;
}

// ---- Error contract ------------------------------------------------------------

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class StudentsApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "StudentsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<StudentsApiError> {
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
  return new StudentsApiError(res.status, message, code, details);
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

/** POST /api/students (admin) → 201 { studentId, rollNo }. */
export function createStudent(
  input: CreateStudentInput
): Promise<{ studentId: string; rollNo: string }> {
  return request("/api/students", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/students?programId&batchId&status&search → StudentSummary[]. */
export function fetchStudents(filters: StudentFilters = {}): Promise<StudentSummary[]> {
  const params = new URLSearchParams();
  if (filters.programId) params.set("programId", filters.programId);
  if (filters.batchId) params.set("batchId", filters.batchId);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return request(`/api/students${qs ? `?${qs}` : ""}`, { method: "GET" });
}

/** GET /api/batches?programId → BatchOption[] for the current tenant. */
export function fetchBatches(params: BatchFilters = {}): Promise<BatchOption[]> {
  const qs = new URLSearchParams();
  if (params.programId) qs.set("programId", params.programId);
  const s = qs.toString();
  return request(`/api/batches${s ? `?${s}` : ""}`, { method: "GET" });
}

/** GET /api/students/[id] → StudentDetail. */
export function fetchStudent(id: string): Promise<StudentDetail> {
  return request(`/api/students/${encodeURIComponent(id)}`, { method: "GET" });
}

/** PATCH /api/students/[id] (admin) → updated student. */
export function updateStudent(id: string, input: UpdateStudentInput): Promise<StudentDetail> {
  return request(`/api/students/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** POST /api/students/[id]/enroll (admin) → 201 { enrollmentId }. */
export function enrollStudent(
  id: string,
  input: EnrollStudentInput
): Promise<{ enrollmentId: string }> {
  return request(`/api/students/${encodeURIComponent(id)}/enroll`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /api/students/[id]/leave-request (student self) → 201 { requestId, status }. */
export function requestLeave(
  id: string,
  input: LeaveRequestInput
): Promise<{ requestId: string; status: string }> {
  return request(`/api/students/${encodeURIComponent(id)}/leave-request`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** PATCH /api/students/leave-requests/[id] (admin). */
export function reviewLeaveRequest(
  requestId: string,
  input: ReviewRequestInput
): Promise<{ id: string; status: string }> {
  return request(`/api/students/leave-requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** POST /api/students/[id]/transfer-request (student self) → 201 { requestId, status }. */
export function requestTransfer(
  id: string,
  input: TransferRequestInput
): Promise<{ requestId: string; status: string }> {
  return request(`/api/students/${encodeURIComponent(id)}/transfer-request`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** PATCH /api/students/transfer-requests/[id] (admin). */
export function reviewTransferRequest(
  requestId: string,
  input: ReviewRequestInput
): Promise<{ id: string; status: string }> {
  return request(`/api/students/transfer-requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** GET /api/students/graduating?batchId (admin) → eligible StudentSummary[]. */
export function fetchEligibleGraduates(batchId: string): Promise<StudentSummary[]> {
  const params = new URLSearchParams({ batchId });
  return request(`/api/students/graduating?${params.toString()}`, { method: "GET" });
}

/** POST /api/students/[id]/graduate (admin) → 200 { studentId, status }. */
export function graduateStudent(
  id: string
): Promise<{ studentId: string; status: StudentStatus }> {
  return request(`/api/students/${encodeURIComponent(id)}/graduate`, {
    method: "POST",
  });
}

/** GET /api/students/leaves (admin) → LeaveRequestRecord[]. */
export function fetchLeaves(): Promise<LeaveRequestRecord[]> {
  return request("/api/students/leaves", { method: "GET" });
}

/** GET /api/students/transfers (admin) → TransferRequestRecord[]. */
export function fetchTransfers(): Promise<TransferRequestRecord[]> {
  return request("/api/students/transfers", { method: "GET" });
}

// ---- Import / Export ----------------------------------------------------------

export type ExportFormat = "csv" | "pdf";

export interface StudentImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export interface ExportFilePayload {
  filename: string;
  content: string;
  contentType: string;
}

/** POST /api/students/import (admin) — multipart upload of a CSV/JSON/PDF file. */
export async function importStudents(file: File, schoolId?: string): Promise<StudentImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  if (schoolId) fd.append("schoolId", schoolId);
  const res = await fetch("/api/students/import", { method: "POST", body: fd });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as StudentImportResult;
}

/** GET /api/students/export?fmt=... (admin) — full student list as CSV/PDF. */
export async function fetchStudentExport(
  fmt: ExportFormat,
  filters: StudentFilters = {}
): Promise<ExportFilePayload> {
  const params = new URLSearchParams({ fmt });
  if (filters.programId) params.set("programId", filters.programId);
  if (filters.batchId) params.set("batchId", filters.batchId);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return request(`/api/students/export?${qs}`, { method: "GET" });
}

/** Trigger a browser download for an export payload. */
export function downloadExport(payload: ExportFilePayload): void {
  const mime = payload.contentType || "text/csv";
  const blob = new Blob([payload.content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = payload.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
