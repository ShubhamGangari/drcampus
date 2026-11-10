// ==============================================================================
// Health & Medical Centre module (Batch B) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/health*` endpoints
// (docs/specs/health.md §4).
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types ------------------------------------------------------------------

export const VISIT_TYPES = ["OPD", "FOLLOW_UP"] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_STATUSES = ["SCHEDULED", "COMPLETED", "FOLLOW_UP_REQUIRED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export interface HealthRecord {
    studentId: string;
    bloodGroup: string | null;
    allergies: string | null;
    chronicConditions: string | null;
    emergencyContact: string | null;
}

export interface HealthVisit {
    id: string;
    studentId: string;
    studentName: string;
    date: string;
    type: VisitType;
    symptoms: string;
    diagnosis: string | null;
    prescription: string | null;
    status: VisitStatus;
}

// ---- Request bodies ----------------------------------------------------------

export interface UpdateRecordInput {
    schoolId?: string;
    bloodGroup?: string | null;
    allergies?: string | null;
    chronicConditions?: string | null;
    emergencyContact?: string | null;
}

export interface CreateVisitInput {
    schoolId?: string;
    studentId: string;
    date?: string;
    type?: VisitType;
    symptoms: string;
    diagnosis?: string | null;
    prescription?: string | null;
    status?: VisitStatus;
    followUpDate?: string | null;
}

export interface UpdateVisitInput {
    schoolId?: string;
    status?: VisitStatus;
    prescription?: string | null;
}

// ---- Role helpers ------------------------------------------------------------

const MANAGE_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Students view their own profile/visits; staff manage. */
export function canAccessHealth(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    return !!user?.role;
}

export function canManageHealth(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user?.role) return false;
    if (user.permissions?.includes("health.manage")) return true;
    return MANAGE_ROLES.includes(user.role);
}

// ---- Error contract ----------------------------------------------------------

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class HealthApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "HealthApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<HealthApiError> {
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
    return new HealthApiError(res.status, message, code, details);
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
    return (await res.json()) as T;
}

// ---- Endpoint wrappers --------------------------------------------------------

/** `GET /api/health/records?studentId=` → `{ records }`. */
export function fetchRecords(
    filters: { schoolId?: string; studentId?: string } = {}
): Promise<{ records: HealthRecord[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.studentId) p.set("studentId", filters.studentId);
    const qs = p.toString();
    return request(`/api/health/records${qs ? `?${qs}` : ""}`);
}

/** `PATCH /api/health/records/[studentId]` (manage) → `200 { record }`. */
export function updateRecord(studentId: string, input: UpdateRecordInput): Promise<{ record: HealthRecord }> {
    return request(`/api/health/records/${encodeURIComponent(studentId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `GET /api/health/visits?studentId=&status=` → `{ visits }`. */
export function fetchVisits(
    filters: { schoolId?: string; studentId?: string; status?: string } = {}
): Promise<{ visits: HealthVisit[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.studentId) p.set("studentId", filters.studentId);
    if (filters.status) p.set("status", filters.status);
    const qs = p.toString();
    return request(`/api/health/visits${qs ? `?${qs}` : ""}`);
}

/** `POST /api/health/visits` (manage) → `201 { visit }`. */
export function createVisit(input: CreateVisitInput): Promise<{ visit: HealthVisit }> {
    return request("/api/health/visits", { method: "POST", body: JSON.stringify(input) });
}

/** `PATCH /api/health/visits/[id]` (manage) → `200 { visit }`. */
export function updateVisit(id: string, input: UpdateVisitInput): Promise<{ visit: HealthVisit }> {
    return request(`/api/health/visits/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
