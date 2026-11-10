// ==============================================================================
// Backlog, Revaluation & Supplementary Exams module (Batch C) — typed frontend
// API client. Mirrors the FROZEN contract for `/api/backlog*` endpoints
// (docs/specs/backlog.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type BacklogStatus = "BACKLOG" | "SUPPLEMENTARY_APPEARED" | "CLEARED";
export type RevaluationStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";
export type SupplementaryExamStatus = "SCHEDULED" | "COMPLETED";

export interface BacklogItem {
    id: string;
    courseCode: string;
    courseTitle: string;
    semester: number;
    academicYear: string;
    marks: number;
    grade: string;
    status: BacklogStatus;
}

export interface AdminRequest {
    id: string;
    studentName: string;
    courseCode: string;
    semester: number;
    status: RevaluationStatus;
    createdAt: string;
}

export interface SupplementaryExamView {
    id: string;
    courseCode: string;
    title: string;
    scheduleDate: string;
    venue: string | null;
}

export interface SupplementaryRegistrationView {
    id: string;
    examId: string;
    studentId: string;
}

// ---- Request bodies ----------------------------------------------------------

export interface RequestRevaluationInput {
    reason: string;
}

export interface ReviewRevaluationInput {
    status: RevaluationStatus;
    remark?: string | null;
}

export interface CreateSupplementaryExamInput {
    schoolId?: string;
    courseId: string;
    scheduleDate: string;
    venue?: string | null;
}

export interface RegisterSupplementaryInput {
    studentId: string;
}

// ---- Form option constants ---------------------------------------------------

export const BACKLOG_STATUSES: BacklogStatus[] = [
    "BACKLOG",
    "SUPPLEMENTARY_APPEARED",
    "CLEARED",
];
export const REVALUATION_STATUSES: RevaluationStatus[] = [
    "REQUESTED",
    "APPROVED",
    "REJECTED",
    "COMPLETED",
];

// ---- Role helpers (spec §2) --------------------------------------------------

/** Every authenticated user has backlog access (student self-service; staff read/admin). */
export function canAccessBacklog(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Management (review requests, schedule supplementary exams) is restricted to controller-level roles / backlog.manage. */
export function canManageBacklog(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("backlog.manage")) return true;
    return (
        user.role === "SUPER_ADMIN" ||
        user.role === "REGISTRAR_ADMIN" ||
        user.role === "EXAM_CONTROLLER"
    );
}

// ---- Error contract ----------------------------------------------------------

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class BacklogApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "BacklogApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<BacklogApiError> {
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
    return new BacklogApiError(res.status, message, code, details);
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

/** `GET /api/backlog/my` → `{ backlogs }` (current student). */
export function fetchMyBacklogs(): Promise<{ backlogs: BacklogItem[] }> {
    return request("/api/backlog/my");
}

/** `POST /api/backlog/[id]/revaluation` → `201 { request }` (status REQUESTED). */
export function requestRevaluation(
    backlogId: string,
    input: RequestRevaluationInput
): Promise<{ request: { id: string; status: RevaluationStatus } }> {
    return request(`/api/backlog/${encodeURIComponent(backlogId)}/revaluation`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/backlog/requests/[id]` (backlog.manage) → `200 { request }`. */
export function reviewRevaluation(
    requestId: string,
    input: ReviewRevaluationInput
): Promise<{ request: { id: string; status: RevaluationStatus } }> {
    return request(`/api/backlog/requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `GET /api/backlog/admin?status=` → `{ requests }` (view/manage). */
export function fetchAdminRequests(
    filters: { status?: RevaluationStatus } = {}
): Promise<{ requests: AdminRequest[] }> {
    const p = new URLSearchParams();
    if (filters.status) p.set("status", filters.status);
    const qs = p.toString();
    return request(`/api/backlog/admin${qs ? `?${qs}` : ""}`);
}

/** `GET /api/backlog/exams` → `{ exams }`. */
export function fetchSupplementaryExams(): Promise<{ exams: SupplementaryExamView[] }> {
    return request("/api/backlog/exams");
}

/** `POST /api/backlog/exams` (backlog.manage) → `201 { exam }`. */
export function createSupplementaryExam(input: CreateSupplementaryExamInput): Promise<{ exam: SupplementaryExamView }> {
    return request("/api/backlog/exams", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `POST /api/backlog/exams/[id]/register` → `201 { registration }`. */
export function registerForSupplementaryExam(
    examId: string,
    input: RegisterSupplementaryInput
): Promise<{ registration: SupplementaryRegistrationView }> {
    return request(`/api/backlog/exams/${encodeURIComponent(examId)}/register`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}
