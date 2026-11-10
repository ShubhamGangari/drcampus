// ==============================================================================
// Notices & Circulars module (Batch A) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/notices*` endpoints
// (docs/specs/notices.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/notices` → `200 { notices: [{ id, title, category, body,
//        pinned, publishedAt, expiresAt, audienceJson }] }`
//   2. `POST /api/notices` → `201 { notice }`
//   3. `PATCH /api/notices/[id]` → `200 { notice }`
//   4. `DELETE /api/notices/[id]` → `200 { success: true }`
//   5. `POST /api/notices/[id]/read` → `200 { success: true }`
//   6. `GET /api/notices/[id]/stats` → `200 { reads: number }`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type NoticeCategory = "EXAM" | "FEE" | "HOLIDAY" | "EVENT" | "GENERAL";

export interface NoticeAudience {
    roles?: string[];
    schoolIds?: string[];
}

export interface Notice {
    id: string;
    schoolId: string;
    title: string;
    category: NoticeCategory;
    body: string;
    audienceJson: string;
    pinned: boolean;
    publishedAt: string;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateNoticeInput {
    schoolId?: string;
    title: string;
    category: NoticeCategory;
    body: string;
    audience?: NoticeAudience;
    pinned?: boolean;
    expiresAt?: string | null;
}

export type UpdateNoticeInput = Partial<
    Omit<CreateNoticeInput, "schoolId"> & { schoolId?: string }
>;

// ---- Form option constants ---------------------------------------------------

export const NOTICE_CATEGORIES = [
    "EXAM",
    "FEE",
    "HOLIDAY",
    "EVENT",
    "GENERAL",
] as const;

export const NOTICE_CATEGORY_LABELS: Record<NoticeCategory, string> = {
    EXAM: "Examination",
    FEE: "Fee",
    HOLIDAY: "Holiday",
    EVENT: "Event",
    GENERAL: "General",
};

// ---- Role helpers (spec §2) --------------------------------------------------

/** Every authenticated user can read the notice board (self-service). */
export function canAccessNotices(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Publishing/editing/deleting notices requires `notices.manage`. Students cannot. */
export function canManageNotices(role?: UserRole): boolean {
    return !!role && role !== "STUDENT";
}

// ---- Error contract ----------------------------------------------------------

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class NoticesApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "NoticesApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<NoticesApiError> {
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
    return new NoticesApiError(res.status, message, code, details);
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

/** `GET /api/notices?schoolId=` → `{ notices }` (audience-filtered board). */
export function fetchNotices(
    filters: { schoolId?: string } = {}
): Promise<{ notices: Notice[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    const qs = p.toString();
    return request(`/api/notices${qs ? `?${qs}` : ""}`);
}

/** `POST /api/notices` (notices.manage) → `201 { notice }`. */
export function publishNotice(input: CreateNoticeInput): Promise<{ notice: Notice }> {
    return request("/api/notices", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/notices/[id]` (notices.manage) → `200 { notice }`. */
export function updateNotice(
    id: string,
    input: UpdateNoticeInput
): Promise<{ notice: Notice }> {
    return request(`/api/notices/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `DELETE /api/notices/[id]` (notices.manage) → `200 { success: true }`. */
export function deleteNotice(id: string): Promise<{ success: boolean }> {
    return request(`/api/notices/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** `POST /api/notices/[id]/read` → `200 { success: true }` (read receipt). */
export function markNoticeRead(id: string): Promise<{ success: boolean }> {
    return request(`/api/notices/${encodeURIComponent(id)}/read`, { method: "POST" });
}

/** `GET /api/notices/[id]/stats` (notices.manage) → `200 { reads }`. */
export function fetchNoticeStats(id: string): Promise<{ reads: number }> {
    return request(`/api/notices/${encodeURIComponent(id)}/stats`);
}
