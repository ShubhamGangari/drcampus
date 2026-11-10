// ==============================================================================
// Mentorship & Career Networking module (Batch D) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/mentorship*` endpoints
// (docs/specs/mentorship.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type MentorshipRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type MentorshipPairingStatus = "ACTIVE" | "ENDED";

export interface MentorProfileRow {
    id: string;
    name: string;
    field: string;
    company: string | null;
    experience: number;
    available: boolean;
}

export interface MentorshipRequestRow {
    id: string;
    mentorId: string;
    mentorName: string;
    studentId: string;
    studentName: string;
    message: string | null;
    status: MentorshipRequestStatus;
    createdAt: string;
}

export interface MentorshipPairingRow {
    id: string;
    mentorId: string;
    mentorName: string;
    studentId: string;
    studentName: string;
    status: MentorshipPairingStatus;
    createdAt: string;
}

export interface MyMentorship {
    pairing?: MentorshipPairingRow;
    requests: MentorshipRequestRow[];
}

export interface AdminMentorshipRow {
    id: string;
    mentorName: string;
    studentName: string;
    status: MentorshipPairingStatus;
    meetingsCount: number;
}

export interface MentorshipStats {
    mentors: number;
    mentees: number;
    activePairings: number;
}

export interface MentorshipAdminData {
    pairings: AdminMentorshipRow[];
    stats: MentorshipStats;
}

// ---- Request bodies -----------------------------------------------------------

export interface RequestMentorInput {
    schoolId?: string;
    mentorId: string;
    message?: string;
}

export interface RespondToRequestInput {
    action: "ACCEPT" | "REJECT";
}

export interface CreatePairingInput {
    schoolId?: string;
    mentorId: string;
    studentId: string;
}

export interface LogMeetingInput {
    schoolId?: string;
    pairingId: string;
    date: string;
    notes?: string;
}

// ---- Form option constants ----------------------------------------------------

export const REQUEST_STATUSES: MentorshipRequestStatus[] = ["PENDING", "ACCEPTED", "REJECTED"];

export const PAIRING_STATUSES: MentorshipPairingStatus[] = ["ACTIVE", "ENDED"];

// ---- Role helpers (spec §2) ---------------------------------------------------

/** Every authenticated user has some mentorship access (browse/request or moderate). */
export function canAccessMentorship(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Administration (pairings) requires `mentorship.manage` / admin. */
export function canManageMentorship(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("mentorship.manage")) return true;
    return user.role === "SUPER_ADMIN" || user.role === "REGISTRAR_ADMIN";
}

/** Read-only mentor data requires `mentorship.view` OR `mentorship.manage` / admin. */
export function canViewMentorship(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user) return false;
    if (user.permissions?.includes("mentorship.view") || user.permissions?.includes("mentorship.manage")) return true;
    return user.role === "SUPER_ADMIN" || user.role === "REGISTRAR_ADMIN";
}

// ---- Error contract -----------------------------------------------------------

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class MentorshipApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "MentorshipApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<MentorshipApiError> {
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
    return new MentorshipApiError(res.status, message, code, details);
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
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

// ---- Endpoint wrappers (one per frozen contract endpoint) ---------------------

/** `GET /api/mentorship/mentors` → `{ mentors }`. */
export function fetchMentors(): Promise<{ mentors: MentorProfileRow[] }> {
    return request("/api/mentorship/mentors");
}

/** `GET /api/mentorship/my` → `{ pairing?, requests }`. */
export function fetchMyMentorship(): Promise<MyMentorship> {
    return request("/api/mentorship/my");
}

/** `POST /api/mentorship/request` → `201 { request }` (dedupe → 409). */
export function requestMentor(input: RequestMentorInput): Promise<{ request: MentorshipRequestRow }> {
    return request("/api/mentorship/request", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/mentorship/request/[id]` (mentor) → `200 { request }`. */
export function respondToMentorshipRequest(id: string, input: RespondToRequestInput): Promise<{ request: MentorshipRequestRow }> {
    return request(`/api/mentorship/request/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `POST /api/mentorship/pairings` (manage) → `201 { pairing }`. */
export function createPairing(input: CreatePairingInput): Promise<{ pairing: MentorshipPairingRow }> {
    return request("/api/mentorship/pairings", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `POST /api/mentorship/meetings` → `201 { meeting }` (ACTIVE pairing only). */
export function logMeeting(input: LogMeetingInput): Promise<{ meeting: { id: string; pairingId: string; date: string; notes: string | null } }> {
    return request("/api/mentorship/meetings", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/mentorship/admin` (manage/view) → `{ pairings, stats }`. */
export function fetchAdminMentorship(): Promise<MentorshipAdminData> {
    return request("/api/mentorship/admin");
}

/** `DELETE /api/mentorship/pairings/[id]` (manage) → `204` (pairing ended). */
export function endPairing(id: string): Promise<void> {
    return request(`/api/mentorship/pairings/${id}`, {
        method: "DELETE",
    });
}
