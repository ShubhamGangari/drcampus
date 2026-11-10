// ==============================================================================
// Hostel management module (Module 8) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/hostel*` endpoints
// (docs/specs/hostel.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/hostel/rooms?schoolId=` → `200 HostelRoom[]`
//   2. `POST /api/hostel/rooms` → `201 { roomId }`
//   3. `GET /api/hostel/allocations?schoolId=&studentId=` → `200 HostelAllocation[]`
//   4. `POST /api/hostel/allocate` → `201 { allocationId }`
//   5. `POST /api/hostel/vacate` → `200 { vacated: true }`
//   6. `GET /api/hostel/mess/bills?schoolId=&studentId=` → `200 MessBill[]`
//   7. `POST /api/hostel/mess/bill` → `201 { billId }`
//   8. `POST /api/hostel/mess/paid` → `200 { paid: true }`
//   9. `GET /api/hostel/complaints?schoolId=` → `200 HostelComplaint[]`
//  10. `POST /api/hostel/complaints` → `201 { complaintId }`
//  11. `PATCH /api/hostel/complaints/[id]` → `200 { id, status }`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export interface HostelRoom {
  id: string;
  roomNo: string;
  type: string;
  capacity: number;
  occupied: number;
}

export type AllocationStatus = "ACTIVE" | "VACATED";

/** Row shape returned by `GET /api/hostel/allocations`. */
export interface HostelAllocation {
  id: string;
  studentId: string;
  studentName: string;
  roomId: string;
  roomNo: string;
  allocationDate: string;
  status: AllocationStatus;
}

export interface MessBill {
  id: string;
  studentId: string;
  studentName: string;
  /** `YYYY-MM`. */
  month: string;
  amount: number;
  paid: boolean;
}

export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

/** Row shape returned by `GET /api/hostel/complaints`. */
export interface HostelComplaint {
  id: string;
  studentId: string;
  studentName: string;
  type: string;
  description: string;
  status: ComplaintStatus;
  createdAt: string;
}

// ---- Request bodies ----------------------------------------------------------

/** Body for `POST /api/hostel/rooms`. `schoolId` required only for Central officers. */
export interface CreateRoomInput {
  schoolId?: string;
  roomNo: string;
  type: string;
  capacity: number;
}

/** Body for `POST /api/hostel/allocate`. */
export interface AllocateInput {
  schoolId?: string;
  studentId: string;
  roomId: string;
}

/** Body for `POST /api/hostel/vacate`. */
export interface VacateInput {
  schoolId?: string;
  allocationId: string;
}

/** Body for `POST /api/hostel/mess/bill`. */
export interface CreateMessBillInput {
  schoolId?: string;
  studentId: string;
  /** `YYYY-MM`. */
  month: string;
  amount: number;
}

/** Body for `POST /api/hostel/mess/paid`. */
export interface MarkPaidInput {
  billId: string;
}

/** Body for `POST /api/hostel/complaints`. */
export interface CreateComplaintInput {
  schoolId?: string;
  type: string;
  description: string;
}

// ---- Form option constants ---------------------------------------------------

/** Room types offered in the Add Room form (free-text `type` field otherwise). */
export const ROOM_TYPES = ["SINGLE", "DOUBLE", "TRIPLE", "DORMITORY"] as const;

/** Complaint categories offered in the Submit Complaint form. */
export const COMPLAINT_TYPES = [
  "MAINTENANCE",
  "CLEANLINESS",
  "FOOD_SERVICE",
  "ELECTRICITY",
  "WATER",
  "SECURITY",
  "OTHER",
] as const;

// ---- Role helpers (spec §2) --------------------------------------------------

/** Roles granted module access: Dean / Registrar, Finance Officer, Student. */
const HOSTEL_PERMITTED_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "DEAN",
  "REGISTRAR_ADMIN",
  "FINANCE_OFFICER",
  "STUDENT",
];

/** Roles that manage rooms and allocations (create, vacate). */
const HOSTEL_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "DEAN", "REGISTRAR_ADMIN"];

/** Roles that manage mess billing (create bills, mark paid). */
const MESS_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE_OFFICER", "REGISTRAR_ADMIN"];

/** Roles that may update complaint status. */
const COMPLAINT_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "DEAN", "REGISTRAR_ADMIN"];

/** Can the role open the Hostel module at all? */
export function canAccessHostel(role?: UserRole): boolean {
  return !!role && HOSTEL_PERMITTED_ROLES.includes(role);
}

/** Can the role create rooms and manage allocations? (Dean / Registrar) */
export function canManageHostelRooms(role?: UserRole): boolean {
  return !!role && HOSTEL_MANAGER_ROLES.includes(role);
}

/** Can the role create mess bills and mark them paid? (Finance / Registrar) */
export function canManageMessBills(role?: UserRole): boolean {
  return !!role && MESS_MANAGER_ROLES.includes(role);
}

/** Can the role update complaint status? (Dean / Registrar) */
export function canUpdateComplaintStatus(role?: UserRole): boolean {
  return !!role && COMPLAINT_MANAGER_ROLES.includes(role);
}

// ---- Error contract ----------------------------------------------------------

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class HostelApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "HostelApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<HostelApiError> {
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
  return new HostelApiError(res.status, message, code, details);
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

/** `GET /api/hostel/rooms?schoolId=` → rooms with occupied count. */
export function fetchRooms(filters: { schoolId?: string } = {}): Promise<HostelRoom[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  const qs = p.toString();
  return request(`/api/hostel/rooms${qs ? `?${qs}` : ""}`);
}

/** `POST /api/hostel/rooms` (DEAN, REGISTRAR_ADMIN) → `201 { roomId }`. */
export function createRoom(input: CreateRoomInput): Promise<{ roomId: string }> {
  return request("/api/hostel/rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `GET /api/hostel/allocations?schoolId=&studentId=` → allocations. */
export function fetchAllocations(
  filters: { schoolId?: string; studentId?: string } = {}
): Promise<HostelAllocation[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  if (filters.studentId) p.set("studentId", filters.studentId);
  const qs = p.toString();
  return request(`/api/hostel/allocations${qs ? `?${qs}` : ""}`);
}

/** `POST /api/hostel/allocate` (DEAN, REGISTRAR_ADMIN) → `201 { allocationId }`. */
export function allocateRoom(input: AllocateInput): Promise<{ allocationId: string }> {
  return request("/api/hostel/allocate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `POST /api/hostel/vacate` (DEAN, REGISTRAR_ADMIN) → `200 { vacated: true }`. */
export function vacateAllocation(input: VacateInput): Promise<{ vacated: boolean }> {
  return request("/api/hostel/vacate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `GET /api/hostel/mess/bills?schoolId=&studentId=` → mess bills. */
export function fetchMessBills(
  filters: { schoolId?: string; studentId?: string } = {}
): Promise<MessBill[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  if (filters.studentId) p.set("studentId", filters.studentId);
  const qs = p.toString();
  return request(`/api/hostel/mess/bills${qs ? `?${qs}` : ""}`);
}

/** `POST /api/hostel/mess/bill` (FINANCE_OFFICER, REGISTRAR_ADMIN) → `201 { billId }`. */
export function createMessBill(input: CreateMessBillInput): Promise<{ billId: string }> {
  return request("/api/hostel/mess/bill", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `POST /api/hostel/mess/paid` (FINANCE_OFFICER, REGISTRAR_ADMIN) → `200 { paid: true }`. */
export function markMessBillPaid(input: MarkPaidInput): Promise<{ paid: boolean }> {
  return request("/api/hostel/mess/paid", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `GET /api/hostel/complaints?schoolId=` → complaints. */
export function fetchComplaints(
  filters: { schoolId?: string } = {}
): Promise<HostelComplaint[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  const qs = p.toString();
  return request(`/api/hostel/complaints${qs ? `?${qs}` : ""}`);
}

/** `POST /api/hostel/complaints` (STUDENT) → `201 { complaintId }`. */
export function createComplaint(
  input: CreateComplaintInput
): Promise<{ complaintId: string }> {
  return request("/api/hostel/complaints", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `PATCH /api/hostel/complaints/[id]` (DEAN, REGISTRAR_ADMIN) → `200 { id, status }`. */
export function updateComplaintStatus(
  id: string,
  input: { status: ComplaintStatus }
): Promise<{ id: string; status: ComplaintStatus }> {
  return request(`/api/hostel/complaints/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
