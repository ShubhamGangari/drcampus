// ==============================================================================
// Parent Portal module (Batch E) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/parent*` endpoints. All auth-bearing
// calls rely on the HttpOnly `auth_token` cookie, so `fetch` here is
// same-origin without manual headers.
import type { AuthUser } from "@/types";

// ==============================================================================

export interface ParentWardCard {
    id: string;
    name: string;
    rollNo: string;
    program: string;
    className: string;
    attendancePercent: number | null;
    feeDues: number;
    gpa: number | null;
    unreadNotices: number;
}

export interface ParentLinkRow {
    id: string;
    parentUserId: string;
    parentName: string;
    studentId: string;
    studentName: string;
}

export interface WardDetail {
    summary: {
        id: string;
        name: string;
        rollNo: string;
        program: string;
        className: string;
    };
    attendance: Array<{
        courseId: string;
        code: string;
        title: string;
        credits: number;
        totalDays: number;
        presentDays: number;
        percentage: number | null;
    }>;
    fees: {
        invoices: Array<{
            id: string;
            invoiceNo: string;
            amount: number;
            paidAmount: number;
            dueDate: string;
            status: string;
            createdAt: string;
        }>;
        payments: Array<{
            id: string;
            invoiceId: string;
            amount: number;
            mode: string;
            receiptNo: string;
            createdAt: string;
        }>;
        currentDue: number;
    };
    results: {
        semesters: Array<{
            semester: number;
            academicYear: string;
            sgpa: number;
            courses: Array<{
                code?: string;
                title?: string;
                credits: number;
                grade: string;
                internalMarks: number;
                externalMarks: number;
                totalMarks: number;
            }>;
        }>;
        latestGpa: number | null;
    };
    exams: {
        upcoming: Array<{
            id: string;
            examId: string;
            code: string;
            title: string;
            examDate: string;
            startTime: string;
            venue: string;
        }>;
    };
}

export interface CreateLinkInput {
    parentUserId: string;
    studentId: string;
    schoolId?: string;
}

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class ParentApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "ParentApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<ParentApiError> {
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
    return new ParentApiError(res.status, message, code, details);
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

// ---- Frontend guards (gates for the portal UI) -------------------------------

/** True when the user can view the parent portal (PARENT role, central, or parent.view). */
export function canViewParentPortal(
    user?: Pick<AuthUser, "role" | "isCentral" | "permissions"> | null
): boolean {
    if (!user) return false;
    if (user.isCentral) return true;
    if (user.role === "PARENT") return true;
    return (user.permissions ?? []).includes("parent.view");
}

/** True when the user can manage parent links (parent.manage). */
export function canManageParentLinks(
    user?: Pick<AuthUser, "role" | "isCentral" | "permissions"> | null
): boolean {
    if (!user) return false;
    if (user.isCentral) return true;
    return (user.permissions ?? []).includes("parent.manage");
}

// ---- Endpoint wrappers (one per frozen contract endpoint) ---------------------

/** `GET /api/parent/students` → `{ students }` (linked wards only). */
export function fetchParentWards(): Promise<{ students: ParentWardCard[] }> {
    return request("/api/parent/students");
}

/** `GET /api/parent/students/[studentId]` → `{ detail }` (read-only). */
export function fetchWardDetail(studentId: string): Promise<{ detail: WardDetail }> {
    return request(`/api/parent/students/${studentId}`);
}

/** `GET /api/parent/links?parentUserId=&studentId=` → `{ links }` (manage). */
export function fetchParentLinks(params?: { parentUserId?: string; studentId?: string }): Promise<{ links: ParentLinkRow[] }> {
    const q = new URLSearchParams();
    if (params?.parentUserId) q.set("parentUserId", params.parentUserId);
    if (params?.studentId) q.set("studentId", params.studentId);
    const qs = q.toString();
    return request(`/api/parent/links${qs ? `?${qs}` : ""}`);
}

/** `POST /api/parent/links` (parent.manage) → `201 { link }`. */
export function createParentLink(input: CreateLinkInput): Promise<{ link: ParentLinkRow }> {
    return request("/api/parent/links", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `DELETE /api/parent/links/[id]` (parent.manage) → `200 { deleted: true }`. */
export function deleteParentLink(id: string): Promise<{ deleted: boolean }> {
    return request(`/api/parent/links/${id}`, {
        method: "DELETE",
    });
}
