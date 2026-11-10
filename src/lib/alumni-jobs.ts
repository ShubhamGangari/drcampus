// ==============================================================================
// Alumni Jobs Board module (Batch D) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/alumni-jobs*` endpoints
// (docs/specs/alumni-jobs.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type JobStatus = "PENDING" | "APPROVED" | "REJECTED";
export type JobType = "FULL_TIME" | "PART_TIME" | "CONTRACT";

export interface AlumniJob {
    id: string;
    title: string;
    company: string;
    location: string | null;
    type: JobType;
    postedByName: string;
    status: JobStatus;
    createdAt: string;
}

export interface AlumniJobApplication {
    id: string;
    jobId: string;
    title: string;
    company: string;
    status: string;
    appliedAt: string;
}

export interface AdminAlumniJob {
    id: string;
    title: string;
    company: string;
    postedByName: string;
    status: JobStatus;
    appliedCount: number;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateJobInput {
    schoolId?: string;
    title: string;
    company: string;
    location?: string;
    type: JobType;
    description: string;
    contact: string;
}

export interface ApplyJobInput {
    schoolId?: string;
    jobId: string;
}

export interface UpdateJobStatusInput {
    status: JobStatus;
}

// ---- Form option constants ---------------------------------------------------

export const JOB_STATUSES: JobStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export const JOB_TYPES: JobType[] = ["FULL_TIME", "PART_TIME", "CONTRACT"];

// ---- Role helpers (spec §2) --------------------------------------------------

/** Every authenticated user has some board access (browse/apply or moderate). */
export function canAccessAlumniJobs(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Moderation (approve/reject/remove) is restricted to `alumniJobs.manage` / admin. */
export function canManageAlumniJobs(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("alumniJobs.manage")) return true;
    return user.role === "SUPER_ADMIN" || user.role === "REGISTRAR_ADMIN";
}

/** Posting is allowed for `alumniJobs.post` holders / admin (server also checks alumni profile). */
export function canPostAlumniJobs(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("alumniJobs.post")) return true;
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

export class AlumniJobsApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "AlumniJobsApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<AlumniJobsApiError> {
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
    return new AlumniJobsApiError(res.status, message, code, details);
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

/** `GET /api/alumni-jobs` → `{ jobs }` (approved posts only). */
export function fetchJobs(): Promise<{ jobs: AlumniJob[] }> {
    return request("/api/alumni-jobs");
}

/** `POST /api/alumni-jobs` (post) → `201 { job }` (status PENDING). */
export function createJob(input: CreateJobInput): Promise<{ job: AlumniJob }> {
    return request("/api/alumni-jobs", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/alumni-jobs/my` → `{ jobs, applications }`. */
export function fetchMyAlumniJobs(): Promise<{ jobs: AlumniJob[]; applications: AlumniJobApplication[] }> {
    return request("/api/alumni-jobs/my");
}

/** `POST /api/alumni-jobs/apply` → `201 { application }` (dedupe → 409). */
export function applyToJob(input: ApplyJobInput): Promise<{ application: AlumniJobApplication }> {
    return request("/api/alumni-jobs/apply", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/alumni-jobs/admin` (manage) → `{ jobs }` with appliedCount. */
export function fetchAdminJobs(): Promise<{ jobs: AdminAlumniJob[] }> {
    return request("/api/alumni-jobs/admin");
}

/** `PATCH /api/alumni-jobs/admin/[id]` (manage) → `200 { job }`. */
export function updateJobStatus(id: string, input: UpdateJobStatusInput): Promise<{ job: AlumniJob }> {
    return request(`/api/alumni-jobs/admin/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
