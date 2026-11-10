// ==============================================================================
// Academic Calendar & Timetable module (Deep Core) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/academic/*` endpoints
// (docs/specs/academic-schedule.md §4). All auth-bearing calls rely on the
// HttpOnly `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/academic/calendar?schoolId=&programId=&type=&from=&to=`
//          → `200 { items: AcademicEvent[] }`
//   2. `POST /api/academic/calendar` → `201 AcademicEvent`
//   3. `PATCH /api/academic/calendar/[id]` → `200 AcademicEvent`
//   4. `DELETE /api/academic/calendar/[id]` → `204`
//   5. `GET /api/academic/timetable?classGroupId=&schoolId=&dayOfWeek=&semester=&academicYear=`
//          → `200 { items: TimetableSlot[] }`
//   6. `POST /api/academic/timetable` → `201 TimetableSlot` | `409 { conflicts }`
//   7. `DELETE /api/academic/timetable/[id]` → `204`
// ==============================================================================

// ---- Types (shapes the backend returns) --------------------------------------

export type AcademicEventType = "HOLIDAY" | "EXAM" | "EVENT" | "DEADLINE";

export interface AcademicEvent {
  id: string;
  schoolId: string;
  programId: string | null;
  title: string;
  type: AcademicEventType;
  /** ISO date string. */
  startDate: string;
  /** ISO date string or null. */
  endDate: string | null;
}

export interface TimetableSlot {
  id: string;
  schoolId: string;
  classGroupId: string;
  /** 1=Mon … 6=Sat. */
  dayOfWeek: number;
  /** "HH:mm". */
  startTime: string;
  /** "HH:mm". */
  endTime: string;
  courseId: string;
  facultyUserId: string;
  room: string | null;
  semester: number;
  academicYear: string;
  course?: { id: string; code: string; title: string; credits: number } | null;
  faculty?: { id: string; name: string; email: string } | null;
  classGroup?: {
    id: string;
    section: string;
    programId: string;
    batchId: string;
  } | null;
}

export interface TimetableConflict {
  type: "CLASS" | "FACULTY" | "ROOM";
  slotId: string;
  detail: string;
}

/** Count of 409 conflict response from POST timetable. */
export class TimetableConflictError extends Error {
  conflicts: TimetableConflict[];
  constructor(conflicts: TimetableConflict[]) {
    super("Timetable conflict detected");
    this.name = "TimetableConflictError";
    this.conflicts = conflicts;
  }
}

/** A generic API error carrying the backend `error.code` + `message`. */
export class AcademicApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AcademicApiError";
    this.code = code;
  }
}

/** Parse a `Response` into JSON, translating backend error payloads. */
async function parseResponse<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // ignore non-JSON (e.g. 204)
  }
  if (!res.ok) {
    const body = data as { error?: { code?: string; message?: string } } | null;
    if (body?.error) {
      throw new AcademicApiError(body.error.code ?? 'API_ERROR', body.error.message ?? 'Request failed');
    }
    throw new AcademicApiError("HTTP_" + res.status, `Request failed (${res.status})`);
  }
  return data as T;
}

// ---- Calendar API -------------------------------------------------------------

export interface CalendarFilters {
  schoolId?: string;
  programId?: string;
  type?: AcademicEventType;
  from?: string;
  to?: string;
}

export async function fetchEvents(filters: CalendarFilters = {}): Promise<AcademicEvent[]> {
  const qs = new URLSearchParams();
  if (filters.schoolId) qs.set("schoolId", filters.schoolId);
  if (filters.programId) qs.set("programId", filters.programId);
  if (filters.type) qs.set("type", filters.type);
  if (filters.from) qs.set("from", filters.from);
  if (filters.to) qs.set("to", filters.to);
  const q = qs.toString();
  const res = await fetch(`/api/academic/calendar${q ? `?${q}` : ""}`);
  const data = await parseResponse<{ items: AcademicEvent[] }>(res);
  return data?.items ?? [];
}

export interface CreateEventInput {
  schoolId?: string;
  programId?: string;
  title: string;
  type: AcademicEventType;
  startDate: string;
  endDate?: string;
}

export async function createEvent(input: CreateEventInput): Promise<AcademicEvent> {
  const res = await fetch("/api/academic/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<AcademicEvent>(res);
}

export async function updateEvent(id: string, input: Partial<CreateEventInput>): Promise<AcademicEvent> {
  const res = await fetch(`/api/academic/calendar/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<AcademicEvent>(res);
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`/api/academic/calendar/${id}`, { method: "DELETE" });
  await parseResponse(res);
}

// ---- Timetable API ------------------------------------------------------------

export interface TimetableFilters {
  schoolId?: string;
  classGroupId?: string;
  dayOfWeek?: number;
  semester?: number;
  academicYear?: string;
}

export async function fetchSlots(filters: TimetableFilters = {}): Promise<TimetableSlot[]> {
  const qs = new URLSearchParams();
  if (filters.schoolId) qs.set("schoolId", filters.schoolId);
  if (filters.classGroupId) qs.set("classGroupId", filters.classGroupId);
  if (filters.dayOfWeek != null) qs.set("dayOfWeek", String(filters.dayOfWeek));
  if (filters.semester != null) qs.set("semester", String(filters.semester));
  if (filters.academicYear) qs.set("academicYear", filters.academicYear);
  const q = qs.toString();
  const res = await fetch(`/api/academic/timetable${q ? `?${q}` : ""}`);
  const data = await parseResponse<{ items: TimetableSlot[] }>(res);
  return data?.items ?? [];
}

export interface CreateSlotInput {
  schoolId?: string;
  classGroupId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  courseId: string;
  facultyUserId: string;
  room?: string;
  semester: number;
  academicYear: string;
}

export async function createSlot(input: CreateSlotInput): Promise<TimetableSlot> {
  const res = await fetch("/api/academic/timetable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    throw new TimetableConflictError(data?.conflicts ?? []);
  }
  return parseResponse<TimetableSlot>(res);
}

export async function deleteSlot(id: string): Promise<void> {
  const res = await fetch(`/api/academic/timetable/${id}`, { method: "DELETE" });
  await parseResponse(res);
}

// ---- Role helpers -------------------------------------------------------------

const MANAGE_EVENT_ROLES = ["REGISTRAR_ADMIN", "DEAN"];
const MANAGE_SLOT_ROLES = ["REGISTRAR_ADMIN", "DEAN", "FACULTY"];

/** Roles permitted to manage calendar events (approximation of perms.ts). */
export function canManageEvents(role?: string): boolean {
  return !!role && MANAGE_EVENT_ROLES.includes(role);
}

/** Roles permitted to manage timetable slots. */
export function canManageSlots(role?: string): boolean {
  return !!role && MANAGE_SLOT_ROLES.includes(role);
}

/** Day-of-week helpers (backend uses 1=Mon … 6=Sat). */
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function dayOfWeekLabel(day: number): string {
  return DAY_LABELS[day - 1] ?? "";
}

export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
