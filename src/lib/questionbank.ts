// ==============================================================================
// Question Bank & Faculty Duty Allocation module (Batch C) — typed frontend API
// client. Mirrors the FROZEN contract for `/api/questionbank*` endpoints
// (docs/specs/questionbank.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type QuestionType = "MCQ" | "SHORT" | "LONG" | "PAPER";
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type DutyRole = "INVIGILATOR" | "CHIEF" | "FLYING_SQUAD";

export interface QuestionView {
    id: string;
    courseId: string;
    courseCode: string;
    unit: string | null;
    type: QuestionType;
    difficulty: QuestionDifficulty;
    status: QuestionStatus;
    authorName: string;
}

export interface DutyView {
    id: string;
    facultyUserId: string;
    facultyName: string;
    examId: string;
    date: string;
    venue: string | null;
    role: DutyRole;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateQuestionInput {
    schoolId?: string;
    courseId: string;
    unit?: string | null;
    type: QuestionType;
    difficulty: QuestionDifficulty;
    content: string;
}

export interface UpdateQuestionInput {
    status: QuestionStatus;
    remark?: string | null;
}

export interface AssignDutyInput {
    schoolId?: string;
    examId: string;
    facultyUserId: string;
    date: string;
    venue?: string | null;
    role: DutyRole;
}

// ---- Form option constants ---------------------------------------------------

export const QUESTION_TYPES: QuestionType[] = ["MCQ", "SHORT", "LONG", "PAPER"];
export const QUESTION_DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];
export const QUESTION_STATUSES: QuestionStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];
export const DUTY_ROLES: DutyRole[] = ["INVIGILATOR", "CHIEF", "FLYING_SQUAD"];

// ---- Role helpers (spec §2) --------------------------------------------------

/** Question bank is a staff/faculty module — students have no access. */
export function canAccessQuestionbank(
    user?: { role?: UserRole; permissions?: string[] } | null
): boolean {
    if (!user) return false;
    if (user.permissions?.includes("questionbank.view") || user.permissions?.includes("questionbank.manage")) {
        return true;
    }
    return (
        user.role === "FACULTY" ||
        user.role === "DEAN" ||
        user.role === "REGISTRAR_ADMIN" ||
        user.role === "EXAM_CONTROLLER" ||
        user.role === "SUPER_ADMIN"
    );
}

/** Approve/reject questions + assign duty is restricted to controller-level roles / questionbank.manage. */
export function canManageQuestionbank(
    user?: { role?: UserRole; permissions?: string[] } | null
): boolean {
    if (!user) return false;
    if (user.permissions?.includes("questionbank.manage")) return true;
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

export class QuestionbankApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "QuestionbankApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<QuestionbankApiError> {
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
    return new QuestionbankApiError(res.status, message, code, details);
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

/** `GET /api/questionbank/questions?courseId=&status=` → `{ questions }`. */
export function fetchQuestions(
    filters: { courseId?: string; status?: QuestionStatus } = {}
): Promise<{ questions: QuestionView[] }> {
    const p = new URLSearchParams();
    if (filters.courseId) p.set("courseId", filters.courseId);
    if (filters.status) p.set("status", filters.status);
    const qs = p.toString();
    return request(`/api/questionbank/questions${qs ? `?${qs}` : ""}`);
}

/** `POST /api/questionbank/questions` (faculty: own course OR manage) → `201 { question }`. */
export function createQuestion(input: CreateQuestionInput): Promise<{ question: QuestionView }> {
    return request("/api/questionbank/questions", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/questionbank/questions/[id]` (questionbank.manage) → `200 { question }`. */
export function updateQuestionStatus(
    id: string,
    input: UpdateQuestionInput
): Promise<{ question: QuestionView }> {
    return request(`/api/questionbank/questions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `GET /api/questionbank/duty?facultyUserId=` → `{ duty }`. */
export function fetchDuty(
    filters: { facultyUserId?: string } = {}
): Promise<{ duty: DutyView[] }> {
    const p = new URLSearchParams();
    if (filters.facultyUserId) p.set("facultyUserId", filters.facultyUserId);
    const qs = p.toString();
    return request(`/api/questionbank/duty${qs ? `?${qs}` : ""}`);
}

/** `POST /api/questionbank/duty` (questionbank.manage) → `201 { duty }`. */
export function assignDuty(input: AssignDutyInput): Promise<{ duty: DutyView }> {
    return request("/api/questionbank/duty", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
