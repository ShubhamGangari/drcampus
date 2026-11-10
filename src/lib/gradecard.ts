// ==============================================================================
// Grade Cards & Transcripts module (Batch C) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/gradecard*` endpoints
// (docs/specs/gradecard.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export interface SemesterSummary {
    semester: number;
    academicYear: string;
    sgpa: number | null;
    credits: number;
    status: string;
}

export interface GradeCardCourse {
    code: string;
    title: string;
    credits: number;
    internalMarks: number;
    externalMarks: number;
    totalMarks: number;
    grade: string | null;
}

export interface GradeCardSemester {
    courses: GradeCardCourse[];
    sgpa: number | null;
    cgpa: number | null;
}

export type TranscriptType = "SEMESTER" | "FULL";

export interface Transcript {
    id: string;
    studentId: string;
    studentName: string;
    transcriptNo: string;
    issuedAt: string;
    semester: number | null;
    type: TranscriptType;
}

export interface VerifyResult {
    transcriptNo: string;
    name: string;
    program: string;
    result: string;
    cgpa: number | null;
}

// ---- Request bodies ----------------------------------------------------------

export interface IssueTranscriptInput {
    schoolId?: string;
    studentId: string;
    type: TranscriptType;
    semester?: number | null;
}

// ---- Form option constants ---------------------------------------------------

export const TRANSCRIPT_TYPES: TranscriptType[] = ["SEMESTER", "FULL"];

// ---- Role helpers (spec §2) --------------------------------------------------

/** Every authenticated user can view grade cards (students their own; staff read/manage). */
export function canAccessGradecard(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Issuing transcripts is restricted to controller/registrar-level roles or gradecard.manage. */
export function canManageGradecard(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("gradecard.manage")) return true;
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

export class GradecardApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "GradecardApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<GradecardApiError> {
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
    return new GradecardApiError(res.status, message, code, details);
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

/** `GET /api/gradecard/semesters` → `{ semesters }` (for current student). */
export function fetchSemesters(): Promise<{ semesters: SemesterSummary[] }> {
    return request("/api/gradecard/semesters");
}

/** `GET /api/gradecard/semester?semester=&academicYear=` → `{ courses, sgpa, cgpa }`. */
export function fetchSemester(
    filters: { semester: number; academicYear?: string }
): Promise<GradeCardSemester> {
    const p = new URLSearchParams();
    p.set("semester", String(filters.semester));
    if (filters.academicYear) p.set("academicYear", filters.academicYear);
    return request(`/api/gradecard/semester?${p.toString()}`);
}

/** `GET /api/gradecard/transcripts` (view/manage) → `{ transcripts }`. */
export function fetchTranscripts(): Promise<{ transcripts: Transcript[] }> {
    return request("/api/gradecard/transcripts");
}

/** `POST /api/gradecard/transcripts` (gradecard.manage) → `201 { transcript }`. */
export function issueTranscript(input: IssueTranscriptInput): Promise<{ transcript: Transcript }> {
    return request("/api/gradecard/transcripts", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/gradecard/verify?transcriptNo=` → `{ transcript }` (public fields). */
export function verifyTranscript(transcriptNo: string): Promise<{ transcript: VerifyResult }> {
    return request(`/api/gradecard/verify?transcriptNo=${encodeURIComponent(transcriptNo)}`);
}
