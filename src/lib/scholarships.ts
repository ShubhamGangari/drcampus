// ==============================================================================
// Scholarships & Concessions module (Batch B) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/scholarships*` endpoints
// (docs/specs/scholarships.md §4).
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types ------------------------------------------------------------------

export const SCHEME_TYPES = ["MERIT", "NEED_BASED", "CATEGORY", "SPORTS"] as const;
export type SchemeType = (typeof SCHEME_TYPES)[number];

export const SCHEME_VALUE_KINDS = ["AMOUNT", "PERCENT"] as const;
export type SchemeValueKind = (typeof SCHEME_VALUE_KINDS)[number];

export const APPLICATION_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ScholarshipScheme {
    id: string;
    name: string;
    type: SchemeType;
    value: number;
    valueKind: SchemeValueKind;
    criteriaJson: string;
    active: boolean;
}

export interface ScholarshipApplication {
    id: string;
    studentId: string;
    schemeId: string;
    schemeName: string;
    status: ApplicationStatus;
    eligible: boolean;
    awardedAmount: number;
    remark: string | null;
    notes: string | null;
    createdAt: string;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateSchemeInput {
    schoolId?: string;
    name: string;
    type: SchemeType;
    value: number;
    valueKind?: SchemeValueKind;
    criteriaJson: string;
}

export type UpdateSchemeInput = Partial<CreateSchemeInput & { active: boolean }>;

export interface CreateApplicationInput {
    schemeId: string;
    notes?: string;
}

export interface UpdateApplicationInput {
    status: ApplicationStatus;
    remark?: string;
}

// ---- Role helpers ------------------------------------------------------------

const MANAGE_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Students browse schemes and self-serve; admins manage. */
export function canAccessScholarships(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    return !!user?.role;
}

export function canManageScholarships(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user?.role) return false;
    if (user.permissions?.includes("scholarships.manage")) return true;
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

export class ScholarshipsApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "ScholarshipsApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<ScholarshipsApiError> {
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
    return new ScholarshipsApiError(res.status, message, code, details);
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

/** `GET /api/scholarships/schemes` → `{ schemes }`. */
export function fetchSchemes(filters: { schoolId?: string } = {}): Promise<{ schemes: ScholarshipScheme[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    const qs = p.toString();
    return request(`/api/scholarships/schemes${qs ? `?${qs}` : ""}`);
}

/** `POST /api/scholarships/schemes` (manage) → `201 { scheme }`. */
export function createScheme(input: CreateSchemeInput): Promise<{ scheme: ScholarshipScheme }> {
    return request("/api/scholarships/schemes", { method: "POST", body: JSON.stringify(input) });
}

/** `PATCH /api/scholarships/schemes/[id]` (manage) → `200 { scheme }`. */
export function updateScheme(id: string, input: UpdateSchemeInput): Promise<{ scheme: ScholarshipScheme }> {
    return request(`/api/scholarships/schemes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `GET /api/scholarships/applications?status=` → `{ applications }`. */
export function fetchApplications(
    filters: { schoolId?: string; status?: string } = {}
): Promise<{ applications: ScholarshipApplication[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.status) p.set("status", filters.status);
    const qs = p.toString();
    return request(`/api/scholarships/applications${qs ? `?${qs}` : ""}`);
}

/** `POST /api/scholarships/applications` (student) → `201 { application }`. */
export function createApplication(input: CreateApplicationInput): Promise<{ application: ScholarshipApplication }> {
    return request("/api/scholarships/applications", { method: "POST", body: JSON.stringify(input) });
}

/** `PATCH /api/scholarships/applications/[id]` (manage) → `200 { application }`. */
export function updateApplication(
    id: string,
    input: UpdateApplicationInput
): Promise<{ application: ScholarshipApplication }> {
    return request(`/api/scholarships/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
