// ==============================================================================
// Internships module (Batch D) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/internships*` endpoints
// (docs/specs/internships.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type InternshipStatus = "APPLIED" | "APPROVED" | "ONGOING" | "COMPLETED" | "REJECTED";

export interface InternshipListing {
    id: string;
    role: string;
    companyName: string;
    mode: "ON_SITE" | "REMOTE" | "HYBRID";
    duration: string;
    stipend: string | null;
    deadline: string | null;
    description: string | null;
}

export interface MyInternship {
    id: string;
    listingId: string;
    role: string;
    companyName: string;
    status: InternshipStatus;
    appliedAt: string;
}

export interface AdminInternship {
    id: string;
    studentId: string;
    studentName: string;
    listingId: string;
    role: string;
    companyName: string;
    status: InternshipStatus;
    startDate: string | null;
    endDate: string | null;
    certificateNo: string | null;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateListingInput {
    schoolId?: string;
    role: string;
    companyName: string;
    mode: "ON_SITE" | "REMOTE" | "HYBRID";
    duration: string;
    stipend?: string;
    deadline?: string | null;
    description?: string;
}

export interface UpdateListingInput {
    role?: string;
    companyName?: string;
    mode?: "ON_SITE" | "REMOTE" | "HYBRID";
    duration?: string;
    stipend?: string | null;
    deadline?: string | null;
    description?: string | null;
}

export interface ApplyInternshipInput {
    schoolId?: string;
    listingId: string;
}

export interface UpdateInternshipStatusInput {
    status: InternshipStatus;
    startDate?: string | null;
    endDate?: string | null;
    certificateNo?: string | null;
}

// ---- Form option constants ---------------------------------------------------

export const INTERNSHIP_STATUSES: InternshipStatus[] = [
    "APPLIED",
    "APPROVED",
    "ONGOING",
    "COMPLETED",
    "REJECTED",
];

export const INTERNSHIP_MODES: InternshipListing["mode"][] = ["ON_SITE", "REMOTE", "HYBRID"];

// ---- Role helpers (spec §2) --------------------------------------------------

/** Every authenticated user has some internship access (student self-service; staff read/admin). */
export function canAccessInternships(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Management (listings/approvals/completion) is restricted to registrar-level roles / internship.manage. */
export function canManageInternships(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("internship.manage")) return true;
    return user.role === "SUPER_ADMIN" || user.role === "REGISTRAR_ADMIN";
}

// ---- Error contract ----------------------------------------------------------

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class InternshipsApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "InternshipsApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<InternshipsApiError> {
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
    return new InternshipsApiError(res.status, message, code, details);
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

// ---- Endpoint wrappers (one per frozen contract endpoint) ---------------------

/** `GET /api/internships/listings` → `{ listings }`. */
export function fetchListings(): Promise<{ listings: InternshipListing[] }> {
    return request("/api/internships/listings");
}

/** `POST /api/internships/listings` (internship.manage) → `201 { listing }`. */
export function createListing(input: CreateListingInput): Promise<{ listing: InternshipListing }> {
    return request("/api/internships/listings", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/internships/listings/[id]` (internship.manage) → `200 { listing }`. */
export function updateListing(id: string, input: UpdateListingInput): Promise<{ listing: InternshipListing }> {
    return request(`/api/internships/listings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `GET /api/internships/my` → `{ internships }` (current student). */
export function fetchMyInternships(): Promise<{ internships: MyInternship[] }> {
    return request("/api/internships/my");
}

/** `POST /api/internships/my` → `201 { internship }` (self-service apply). */
export function applyToInternship(input: ApplyInternshipInput): Promise<{ internship: MyInternship }> {
    return request("/api/internships/my", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/internships/admin` (manage/view) → `{ internships }`. */
export function fetchAdminInternships(): Promise<{ internships: AdminInternship[] }> {
    return request("/api/internships/admin");
}

/** `PATCH /api/internships/admin/[id]` (internship.manage) → `200 { internship }`. */
export function updateInternshipStatus(id: string, input: UpdateInternshipStatusInput): Promise<{ internship: AdminInternship }> {
    return request(`/api/internships/admin/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
