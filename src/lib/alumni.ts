// ==============================================================================
// Alumni Management module (Module 10) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/alumni*` endpoints
// (docs/specs/alumni.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/alumni?schoolId=&search=` → `200 Alumni[]`
//   2. `POST /api/alumni` → `201 { alumniId }`
//   3. `PATCH /api/alumni/[id]` → `200 { id }`
//   4. `GET /api/alumni/events?schoolId=` → `200 AlumniEvent[]`
//   5. `POST /api/alumni/events` → `201 { eventId }`
//   6. `POST /api/alumni/events/[id]/register` → `201 { registrationId }`
//   7. `DELETE /api/alumni/events/[id]/register` → `200 { deregistered: true }`
//   8. `GET /api/alumni/donations?schoolId=` → `200 { donations, totals }`
//   9. `POST /api/alumni/donations` → `201 { donationId }`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

/** Row shape returned by `GET /api/alumni`. */
export interface Alumni {
  id: string;
  studentId: string;
  studentName: string;
  /** Graduation batch/year, e.g. `2025`. */
  batch?: string | null;
  email: string;
  phone?: string | null;
  currentCompany?: string | null;
  /** `YYYY-MM-DDTHH:mm:ss.sssZ`. */
  createdAt: string;
}

/** Row shape returned by `GET /api/alumni/events`. */
export interface AlumniEvent {
  id: string;
  title: string;
  /** `YYYY-MM-DD`. */
  date: string;
  location?: string | null;
  /** Number of registered alumni. */
  registrations: number;
  /** Whether the current alumni user has registered. */
  registered: boolean;
}

/** Row shape returned by `GET /api/alumni/donations`. */
export interface AlumniDonation {
  id: string;
  alumniId: string;
  alumniName: string;
  amount: number;
  mode: string;
  /** `YYYY-MM-DDTHH:mm:ss.sssZ`. */
  createdAt: string;
}

/** Aggregate returned alongside `GET /api/alumni/donations`. */
export interface DonationTotals {
  count: number;
  sum: number;
}

/** Full response shape of `GET /api/alumni/donations`. */
export interface AlumniDonationsResponse {
  donations: AlumniDonation[];
  totals: DonationTotals;
}

// ---- Request bodies ----------------------------------------------------------

/** Body for `POST /api/alumni`. `schoolId` required only for Central officers. */
export interface CreateAlumniInput {
  schoolId?: string;
  studentId: string;
  email: string;
  phone?: string;
  currentCompany?: string;
  batch?: string;
}

/** Body for `PATCH /api/alumni/[id]`. All fields optional. */
export interface UpdateAlumniInput {
  email?: string;
  phone?: string;
  currentCompany?: string;
  batch?: string;
}

/** Body for `POST /api/alumni/events`. `schoolId` required only for Central officers. */
export interface CreateEventInput {
  schoolId?: string;
  title: string;
  /** `YYYY-MM-DD`. */
  date: string;
  location?: string;
}

/** Body for `POST /api/alumni/donations`. `schoolId` required only for Central officers. */
export interface RecordDonationInput {
  schoolId?: string;
  amount: number;
  mode: string;
}

// ---- Form option constants ---------------------------------------------------

/** Donation modes offered in the Record Donation form. */
export const DONATION_MODES = [
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "NEFT/RTGS",
  "Cash",
] as const;

// ---- Role helpers (spec §2) --------------------------------------------------

/** Roles granted alumni module access: Registrar/Admin, Dean, Student. */
const ALUMNI_PERMITTED_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "STUDENT",
];

/** Roles that view the alumni directory (Registrar/Admin, Dean). */
const ALUMNI_VIEWER_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN", "DEAN"];

/** Roles that manage alumni records & events (Registrar/Admin). */
const ALUMNI_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Can the role open the Alumni module at all? */
export function canAccessAlumni(role?: UserRole): boolean {
  return !!role && ALUMNI_PERMITTED_ROLES.includes(role);
}

/** Can the role view the directory / donation reports? (Registrar/Admin, Dean) */
export function canViewAlumni(role?: UserRole): boolean {
  return !!role && ALUMNI_VIEWER_ROLES.includes(role);
}

/** Can the role manage alumni records & events? (Registrar/Admin) */
export function canManageAlumni(role?: UserRole): boolean {
  return !!role && ALUMNI_MANAGER_ROLES.includes(role);
}

/** Is the role an alumni student (own-record scope)? */
export function isAlumniStudent(role?: UserRole): boolean {
  return role === "STUDENT";
}

/** Can the role self-register for events / record a donation? (Student) */
export function canSelfAct(role?: UserRole): boolean {
  return isAlumniStudent(role);
}

// ---- Display helpers ----------------------------------------------------------

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format a currency amount as INR without decimals. */
export function formatCurrency(value: number): string {
  return INR.format(value || 0);
}

/** Format an ISO date as a friendly label (e.g. `7 Nov 2026`). */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---- Error contract ----------------------------------------------------------

export interface AlumniApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class AlumniApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "AlumniApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<AlumniApiError> {
  let message = `Request failed with status ${res.status}`;
  let code: string | undefined;
  let details: unknown;
  try {
    const body = (await res.json()) as AlumniApiErrorBody;
    if (body?.error?.message) message = body.error.message;
    code = body?.error?.code;
    details = body?.error?.details;
  } catch {
    /* no json body */
  }
  return new AlumniApiError(res.status, message, code, details);
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

/** `GET /api/alumni?schoolId=&search=` → alumni records (Registrar/Dean). */
export function fetchAlumni(
  filters: { schoolId?: string; search?: string } = {}
): Promise<Alumni[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  if (filters.search) p.set("search", filters.search);
  const qs = p.toString();
  return request(`/api/alumni${qs ? `?${qs}` : ""}`);
}

/** `POST /api/alumni` (Registrar/Admin) → `201 { alumniId }`. */
/** `GET /api/alumni/me` (STUDENT) → own alumni record, `404` if none. */
export function fetchMyAlumni(): Promise<Alumni> {
  return request("/api/alumni/me");
}

/** `POST /api/alumni` (Registrar/Admin) → `201 { alumniId }`. */
export function createAlumni(input: CreateAlumniInput): Promise<{ alumniId: string }> {
  return request("/api/alumni", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `PATCH /api/alumni/[id]` (Registrar/Admin or own student) → `200 { id }`. */
export function updateAlumni(
  id: string,
  input: UpdateAlumniInput
): Promise<{ id: string }> {
  return request(`/api/alumni/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** `GET /api/alumni/events?schoolId=` → alumni events (all permitted roles). */
export function fetchEvents(
  filters: { schoolId?: string } = {}
): Promise<AlumniEvent[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  const qs = p.toString();
  return request(`/api/alumni/events${qs ? `?${qs}` : ""}`);
}

/** `POST /api/alumni/events` (Registrar/Admin) → `201 { eventId }`. */
export function createEvent(input: CreateEventInput): Promise<{ eventId: string }> {
  return request("/api/alumni/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `POST /api/alumni/events/[id]/register` (Student, own alumni) → `201 { registrationId }`. */
export function registerForEvent(eventId: string): Promise<{ registrationId: string }> {
  return request(`/api/alumni/events/${encodeURIComponent(eventId)}/register`, {
    method: "POST",
  });
}

/** `DELETE /api/alumni/events/[id]/register` (Student, own alumni) → `200 { deregistered }`. */
export function deregisterFromEvent(
  eventId: string
): Promise<{ deregistered: boolean }> {
  return request(`/api/alumni/events/${encodeURIComponent(eventId)}/register`, {
    method: "DELETE",
  });
}

/** `GET /api/alumni/donations?schoolId=` → donations + totals (Registrar/Dean). */
export function fetchDonations(
  filters: { schoolId?: string } = {}
): Promise<AlumniDonationsResponse> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  const qs = p.toString();
  return request(`/api/alumni/donations${qs ? `?${qs}` : ""}`);
}

/** `POST /api/alumni/donations` (Student, own alumni) → `201 { donationId }`. */
export function recordDonation(
  input: RecordDonationInput
): Promise<{ donationId: string }> {
  return request("/api/alumni/donations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
