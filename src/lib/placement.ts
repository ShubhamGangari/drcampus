// ==============================================================================
// Placement Cell module (Batch D) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/placement*` endpoints
// (docs/specs/placement.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type PlacementStatus = "APPLIED" | "SHORTLISTED" | "OFFERED" | "PLACED" | "REJECTED";

export interface PlacementCompany {
    id: string;
    name: string;
    sector: string | null;
    drives?: PlacementDrive[];
}

export interface PlacementDrive {
    id: string;
    title: string;
    date: string;
    mode: "ONLINE" | "OFFLINE";
    role: string;
    package: string | null;
    location: string | null;
}

export interface PlacementPost {
    id: string;
    title: string;
    companyName: string;
    package: string | null;
    deadline: string | null;
    eligibility: string | null;
}

export interface PlacementApplication {
    id: string;
    postId: string;
    title: string;
    companyName: string;
    status: PlacementStatus;
    appliedAt: string;
}

export interface PlacementAdminApplication {
    id: string;
    studentId: string;
    studentName: string;
    postId: string;
    title: string;
    companyName: string;
    status: PlacementStatus;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateCompanyInput {
    schoolId?: string;
    name: string;
    sector?: string;
}

export interface UpdateCompanyInput {
    name?: string;
    sector?: string | null;
}

export interface CreateDriveInput {
    schoolId?: string;
    title: string;
    date: string;
    mode: "ONLINE" | "OFFLINE";
    role: string;
    package?: string;
    location?: string;
}

export interface CreatePostInput {
    schoolId?: string;
    title: string;
    companyId: string;
    driveId?: string;
    package?: string;
    deadline?: string | null;
    eligibility?: string;
}

export interface ApplyInput {
    postId: string;
}

export interface UpdateApplicationStatusInput {
    status: PlacementStatus;
}

// ---- Form option constants ---------------------------------------------------

export const PLACEMENT_STATUSES: PlacementStatus[] = [
    "APPLIED",
    "SHORTLISTED",
    "OFFERED",
    "PLACED",
    "REJECTED",
];

export const DRIVE_MODES: PlacementDrive["mode"][] = ["ONLINE", "OFFLINE"];

// ---- Role helpers (spec §2) --------------------------------------------------

/**
 * Every authenticated user has some placement access (student self-service;
 * staff read/admin). Returns true for any role.
 */
export function canAccessPlacement(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Management (companies/posts/drives/offers) is restricted to registrar-level roles / placement.manage. */
export function canManagePlacement(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("placement.manage")) return true;
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

export class PlacementApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "PlacementApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<PlacementApiError> {
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
    return new PlacementApiError(res.status, message, code, details);
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

/** `GET /api/placement/companies` → `{ companies }`. */
export function fetchCompanies(): Promise<{ companies: PlacementCompany[] }> {
    return request("/api/placement/companies");
}

/** `POST /api/placement/companies` (placement.manage) → `201 { company }`. */
export function createCompany(input: CreateCompanyInput): Promise<{ company: PlacementCompany }> {
    return request("/api/placement/companies", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/placement/companies/[id]` (placement.manage) → `200 { company }`. */
export function updateCompany(id: string, input: UpdateCompanyInput): Promise<{ company: PlacementCompany }> {
    return request(`/api/placement/companies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `POST /api/placement/companies/[id]/drives` (placement.manage) → `201 { drive }`. */
export function createDrive(companyId: string, input: CreateDriveInput): Promise<{ drive: PlacementDrive }> {
    return request(`/api/placement/companies/${companyId}/drives`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/placement/posts` → `{ posts }`. */
export function fetchPosts(): Promise<{ posts: PlacementPost[] }> {
    return request("/api/placement/posts");
}

/** `POST /api/placement/posts` (placement.manage) → `201 { post }`. */
export function createPost(input: CreatePostInput): Promise<{ post: PlacementPost }> {
    return request("/api/placement/posts", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/placement/my` → `{ applications }` (current student). */
export function fetchMyApplications(): Promise<{ applications: PlacementApplication[] }> {
    return request("/api/placement/my");
}

/** `POST /api/placement/my` → `201 { application }` (self-service apply). */
export function applyToPost(input: ApplyInput): Promise<{ application: PlacementApplication }> {
    return request("/api/placement/my", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/placement/admin/applications?postId=` (manage/view) → `{ applications }`. */
export function fetchAdminApplications(postId?: string): Promise<{ applications: PlacementAdminApplication[] }> {
    const qs = postId ? `?postId=${encodeURIComponent(postId)}` : "";
    return request(`/api/placement/admin/applications${qs}`);
}

/** `PATCH /api/placement/admin/applications/[id]` (placement.manage) → `200 { application }`. */
export function updateApplicationStatus(id: string, input: UpdateApplicationStatusInput): Promise<{ application: PlacementAdminApplication }> {
    return request(`/api/placement/admin/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
