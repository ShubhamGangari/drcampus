// ==============================================================================
// Course & Semester Registration module (Batch C) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/registration*` endpoints
// (docs/specs/registration.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type CourseType = "CORE" | "ELECTIVE";
export type RegistrationStatus = "REGISTERED" | "DROPPED";

export interface CatalogCourse {
    id: string;
    code: string;
    title: string;
    credits: number;
    type: CourseType;
    seatsTotal: number;
    seatsFilled: number;
    instructorName: string | null;
}

export interface RegistrationWindow {
    id: string;
    semester: number;
    academicYear: string;
    opensAt: string;
    closesAt: string;
    active: boolean;
}

export interface MyRegistration {
    id: string;
    courseId: string;
    code: string;
    title: string;
    credits: number;
    status: RegistrationStatus;
}

export interface AllRegistration {
    id: string;
    studentId: string;
    studentName: string;
    courseId: string;
    courseCode: string;
    status: RegistrationStatus;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateWindowInput {
    schoolId?: string;
    semester: number;
    academicYear: string;
    opensAt: string;
    closesAt: string;
}

export interface SubmitRegistrationInput {
    courseIds: string[];
}

// ---- Form option constants ---------------------------------------------------

export const COURSE_TYPES: CourseType[] = ["CORE", "ELECTIVE"];
export const REGISTRATION_STATUSES: RegistrationStatus[] = ["REGISTERED", "DROPPED"];

// ---- Role helpers (spec §2) --------------------------------------------------

/** Every authenticated user has some registration access (student self-service; staff read/admin). */
export function canAccessRegistration(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Management (open/close windows, override seats) is restricted to registrar-level roles / registration.manage. */
export function canManageRegistration(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("registration.manage")) return true;
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

export class RegistrationApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "RegistrationApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<RegistrationApiError> {
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
    return new RegistrationApiError(res.status, message, code, details);
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

/** `GET /api/registration/catalog?semester=&type=` → `{ courses }`. */
export function fetchCatalog(
    filters: { semester?: number; type?: CourseType } = {}
): Promise<{ courses: CatalogCourse[] }> {
    const p = new URLSearchParams();
    if (filters.semester !== undefined) p.set("semester", String(filters.semester));
    if (filters.type) p.set("type", filters.type);
    const qs = p.toString();
    return request(`/api/registration/catalog${qs ? `?${qs}` : ""}`);
}

/** `GET /api/registration/windows` → `{ windows }`. */
export function fetchWindows(): Promise<{ windows: RegistrationWindow[] }> {
    return request("/api/registration/windows");
}

/** `POST /api/registration/windows` (registration.manage) → `201 { window }`. */
export function createWindow(input: CreateWindowInput): Promise<{ window: RegistrationWindow }> {
    return request("/api/registration/windows", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/registration/my` → `{ registrations }` (current student). */
export function fetchMyRegistrations(): Promise<{ registrations: MyRegistration[] }> {
    return request("/api/registration/my");
}

/** `POST /api/registration/my` → `201 { registrations }` (validates window/caps/dup). */
export function submitMyRegistrations(input: SubmitRegistrationInput): Promise<{ registrations: MyRegistration[] }> {
    return request("/api/registration/my", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/registration/all?courseId=&semester=` → `{ registrations }` (view/manage). */
export function fetchAllRegistrations(
    filters: { courseId?: string; semester?: number } = {}
): Promise<{ registrations: AllRegistration[] }> {
    const p = new URLSearchParams();
    if (filters.courseId) p.set("courseId", filters.courseId);
    if (filters.semester !== undefined) p.set("semester", String(filters.semester));
    const qs = p.toString();
    return request(`/api/registration/all${qs ? `?${qs}` : ""}`);
}
