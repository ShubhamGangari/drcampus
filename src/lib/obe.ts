// ==============================================================================
// OBE CO–PO Mapping module (Module 5) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/obe*` endpoints (docs/specs/obe.md §4).
// All auth-bearing calls rely on the HttpOnly `auth_token` cookie set by the portal
// login route, so `fetch` here is same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/obe/courses?programId` → `200 CourseOutcomeSet[]`
//   2. `POST /api/obe/courses`           → `201 { courseId }`
//   3. `PUT /api/obe/courses/:courseId/cos/:coId` → `200 { coId, code, description }`
//   4. `GET /api/obe/programs/:programId/pos` → `200 ProgramOutcome[]`
//   5. `POST /api/obe/programs/:programId/pos` → `201 { poId }`
//   6. `GET /api/obe/mappings?courseId=`  → `200 MappingRow[]`
//   7. `POST /api/obe/mappings`            → `201 { courseId }`
//   8. `POST /api/obe/attainment`          → `201 { attainmentId }`
//   9. `GET /api/obe/attainment?courseId=&academicYear=` → `200 AttainmentRecord[]`
//  10. `GET /api/obe/reports/course-attainment?courseId=&academicYear=` → `200 CourseAttainmentReport`
//  11. `GET /api/obe/reports/po-attainment?programId=&academicYear=` → `200 PoAttainmentReport`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export interface ProgramOutcome {
  id: string;
  code: string;
  description: string;
}

export interface CourseOutcome {
  id: string;
  code: string;
  description: string;
}

/** Row shape returned by `GET /api/obe/courses`. */
export interface CourseOutcomeSet {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  programId: string;
  cos: CourseOutcome[];
}

/** Row shape returned by `GET /api/obe/mappings?courseId=`. */
export interface MappingRow {
  coId: string;
  coCode: string;
  poId: string;
  poCode: string;
  weight: number;
}

/** Row shape returned by `GET /api/obe/attainment`. */
export interface AttainmentRecord {
  id: string;
  courseId: string;
  coId: string;
  coCode: string;
  attainment: number;
  academicYear: string;
}

export interface CourseAttainmentReport {
  courseId: string;
  courseCode: string;
  academicYear: string;
  cos: { coId: string; coCode: string; attainment: number }[];
}

export interface PoAttainmentReport {
  programId: string;
  academicYear: string;
  pos: {
    poId: string;
    poCode: string;
    attainment: number;
    contributingCourses: {
      courseId: string;
      courseCode: string;
      courseTitle: string;
      attainment: number;
    }[];
  }[];
}

// ---- Request bodies -----------------------------------------------------------

export interface CreateProgramOutcomeInput {
  code: string;
  description: string;
}

export interface CourseOutcomeDraft {
  code: string;
  description: string;
}

export interface AttachCourseOutcomesInput {
  /** Required for Central officers (schoolId "ALL"); ignored for school-scoped users. */
  schoolId?: string;
  courseId: string;
  cos: CourseOutcomeDraft[];
}

export interface UpdateCourseOutcomeInput {
  code?: string;
  description?: string;
}

export interface MappingWeightDraft {
  coId: string;
  poId: string;
  weight: number;
}

export interface SaveMappingInput {
  schoolId?: string;
  courseId: string;
  mappings: MappingWeightDraft[];
}

export interface EnterAttainmentInput {
  schoolId?: string;
  courseId: string;
  coId: string;
  academicYear: string;
  attainment: number;
}

// ---- Filter shapes ------------------------------------------------------------

export interface AttainmentFilters {
  courseId?: string;
  academicYear?: string;
}

export interface CourseReportFilters {
  courseId: string;
  academicYear: string;
}

export interface PoReportFilters {
  programId: string;
  academicYear: string;
}

// ---- Role helpers -------------------------------------------------------------

export function isFacultyRole(role?: UserRole): boolean {
  return role === "FACULTY";
}

export function isDeanRole(role?: UserRole): boolean {
  return role === "DEAN";
}

export function isRegistrarRole(role?: UserRole): boolean {
  return role === "REGISTRAR_ADMIN";
}

/** Faculty may edit OBE data; Dean/Registrar view read-only. */
export function canEditObe(role?: UserRole): boolean {
  return isFacultyRole(role) || role === "SUPER_ADMIN";
}

/** Dean & Registrar access the program-level PO attainment report. */
export function canViewPoReports(role?: UserRole): boolean {
  return role === "SUPER_ADMIN" || isDeanRole(role) || isRegistrarRole(role);
}

// ---- Pure business rules (spec §3 + acceptance criteria) ----------------------

/**
 * Average CO attainment (0–100) for a course given its per-CO attainment values.
 * Ignores out-of-range / non-finite inputs; empty input → 0.
 */
export function calculateCourseAttainment(values: readonly number[]): number {
  const clean = values.filter((v) => Number.isFinite(v) && v >= 0 && v <= 100);
  if (clean.length === 0) return 0;
  const sum = clean.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / clean.length) * 100) / 100;
}

/** Clamp a mapping weight into [0, 1], returning 0 for out-of-range/invalid. */
export function normalizeWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Total mapped weight across POs for a single CO (for mapping hints). */
export function sumCoWeight(mappings: readonly MappingWeightDraft[]): number {
  return mappings.reduce((acc, m) => acc + normalizeWeight(m.weight), 0);
}

// ---- CSV export helpers (client side) -----------------------------------------

/** Serialize rows (columns may be strings/numbers) into a CSV string. */
export function toCsv(rows: readonly (string | number)[][]): string {
  const escape = (cell: string | number) => {
    const s = String(cell ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((row) => row.map(escape).join(",")).join("\r\n");
}

/** Trigger a client-side download of `csv` as `filename`. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Error contract ------------------------------------------------------------

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ObeApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ObeApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<ObeApiError> {
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
  return new ObeApiError(res.status, message, code, details);
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

/** GET /api/obe/courses?programId (Faculty/Dean/Registrar) → CourseOutcomeSet[]. */
export function fetchCourses(programId?: string): Promise<CourseOutcomeSet[]> {
  const p = new URLSearchParams();
  if (programId) p.set("programId", programId);
  const qs = p.toString();
  return request(`/api/obe/courses${qs ? `?${qs}` : ""}`, { method: "GET" });
}

/** POST /api/obe/courses (Faculty) → 201 { courseId }. */
export function attachCourseOutcomes(
  input: AttachCourseOutcomesInput
): Promise<{ courseId: string }> {
  return request("/api/obe/courses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** PUT /api/obe/courses/:courseId/cos/:coId (Faculty) → 200 updated CO. */
export function updateCourseOutcome(
  courseId: string,
  coId: string,
  input: UpdateCourseOutcomeInput
): Promise<{ coId: string; code: string; description: string }> {
  return request(`/api/obe/courses/${courseId}/cos/${coId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** GET /api/obe/programs/:programId/pos (Faculty/Dean/Registrar) → ProgramOutcome[]. */
export function fetchProgramOutcomes(programId: string): Promise<ProgramOutcome[]> {
  return request(`/api/obe/programs/${programId}/pos`, { method: "GET" });
}

/** POST /api/obe/programs/:programId/pos (Faculty) → 201 { poId }. */
export function createProgramOutcome(
  programId: string,
  input: CreateProgramOutcomeInput
): Promise<{ poId: string }> {
  return request(`/api/obe/programs/${programId}/pos`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/obe/mappings?courseId= (Faculty/Dean/Registrar) → MappingRow[]. */
export function fetchMappings(courseId: string): Promise<MappingRow[]> {
  const p = new URLSearchParams({ courseId });
  return request(`/api/obe/mappings?${p.toString()}`, { method: "GET" });
}

/** POST /api/obe/mappings (Faculty) → 201 { courseId }. */
export function saveMappings(input: SaveMappingInput): Promise<{ courseId: string }> {
  return request("/api/obe/mappings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /api/obe/attainment (Faculty) → 201 { attainmentId }. */
export function enterAttainment(input: EnterAttainmentInput): Promise<{ attainmentId: string }> {
  return request("/api/obe/attainment", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/obe/attainment?courseId=&academicYear= → AttainmentRecord[]. */
export function fetchAttainment(filters: AttainmentFilters): Promise<AttainmentRecord[]> {
  const p = new URLSearchParams();
  if (filters.courseId) p.set("courseId", filters.courseId);
  if (filters.academicYear) p.set("academicYear", filters.academicYear);
  const qs = p.toString();
  return request(`/api/obe/attainment${qs ? `?${qs}` : ""}`, { method: "GET" });
}

/** GET /api/obe/reports/course-attainment?courseId=&academicYear= → CourseAttainmentReport. */
export function fetchCourseAttainmentReport(filters: CourseReportFilters): Promise<CourseAttainmentReport> {
  const p = new URLSearchParams({
    courseId: filters.courseId,
    academicYear: filters.academicYear,
  });
  return request(`/api/obe/reports/course-attainment?${p.toString()}`, { method: "GET" });
}

/** GET /api/obe/reports/po-attainment?programId=&academicYear= (Dean/Registrar) → PoAttainmentReport. */
export function fetchPoAttainmentReport(filters: PoReportFilters): Promise<PoAttainmentReport> {
  const p = new URLSearchParams({
    programId: filters.programId,
    academicYear: filters.academicYear,
  });
  return request(`/api/obe/reports/po-attainment?${p.toString()}`, { method: "GET" });
}
