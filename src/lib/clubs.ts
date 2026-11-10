// ==============================================================================
// Clubs, Societies & Events module (Batch B) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/clubs*` endpoints
// (docs/specs/clubs.md §4).
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types ------------------------------------------------------------------

export const CLUB_CATEGORIES = ["TECHNICAL", "CULTURAL", "SPORTS", "LITERARY", "SOCIAL", "OTHER"] as const;
export type ClubCategory = (typeof CLUB_CATEGORIES)[number];

export const CLUB_EVENT_STATUSES = ["UPCOMING", "COMPLETED", "CANCELLED"] as const;
export type ClubEventStatus = (typeof CLUB_EVENT_STATUSES)[number];

export const MEMBER_ACTIONS = ["JOIN", "LEAVE"] as const;
export type MemberAction = (typeof MEMBER_ACTIONS)[number];

export interface Club {
    id: string;
    name: string;
    category: string;
    description: string | null;
    coordinatorName: string | null;
    memberCount: number;
    joined?: boolean;
}

export interface ClubEvent {
    id: string;
    clubId: string;
    clubName: string;
    title: string;
    date: string;
    venue: string | null;
    status: ClubEventStatus;
    rsvpCount: number;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateClubInput {
    schoolId?: string;
    name: string;
    category: ClubCategory;
    description?: string | null;
    coordinatorUserId?: string | null;
}

export interface UpdateClubInput {
    schoolId?: string;
    name?: string;
    category?: ClubCategory;
    description?: string | null;
    coordinatorUserId?: string | null;
}

export interface MemberActionInput {
    action: MemberAction;
}

export interface CreateEventInput {
    schoolId?: string;
    clubId: string;
    title: string;
    date: string;
    venue?: string | null;
    description?: string | null;
}

export interface UpdateEventInput {
    schoolId?: string;
    title?: string;
    date?: string;
    venue?: string | null;
    description?: string | null;
    status?: ClubEventStatus;
}

// ---- Role helpers ------------------------------------------------------------

const MANAGE_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Any authenticated user can view the club board and self-serve membership. */
export function canAccessClubs(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    return !!user?.role;
}

export function canManageClubs(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user?.role) return false;
    if (user.permissions?.includes("clubs.manage")) return true;
    return MANAGE_ROLES.includes(user.role);
}

// ---- Error contract ----------------------------------------------------------

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class ClubsApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "ClubsApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<ClubsApiError> {
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
    return new ClubsApiError(res.status, message, code, details);
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

// ---- Endpoint wrappers --------------------------------------------------------

/** `GET /api/clubs?category=` → `{ clubs }`. */
export function fetchClubs(
    filters: { schoolId?: string; category?: string } = {}
): Promise<{ clubs: Club[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.category) p.set("category", filters.category);
    const qs = p.toString();
    return request(`/api/clubs${qs ? `?${qs}` : ""}`);
}

/** `POST /api/clubs` (manage) → `201 { club }`. */
export function createClub(input: CreateClubInput): Promise<{ club: Club }> {
    return request("/api/clubs", { method: "POST", body: JSON.stringify(input) });
}

/** `PATCH /api/clubs/[id]` (manage or coordinator) → `200 { club }`. */
export function updateClub(id: string, input: UpdateClubInput): Promise<{ club: Club }> {
    return request(`/api/clubs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `POST /api/clubs/[id]/members` (any authenticated) → `200 { club }`. */
export function memberAction(id: string, input: MemberActionInput): Promise<{ club: Club }> {
    return request(`/api/clubs/${encodeURIComponent(id)}/members`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `GET /api/clubs/events?future=` → `{ events }`. */
export function fetchEvents(
    filters: { schoolId?: string; future?: boolean } = {}
): Promise<{ events: ClubEvent[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.future) p.set("future", "true");
    const qs = p.toString();
    return request(`/api/clubs/events${qs ? `?${qs}` : ""}`);
}

/** `POST /api/clubs/events` (manage or coordinator) → `201 { event }`. */
export function createEvent(input: CreateEventInput): Promise<{ event: ClubEvent }> {
    return request("/api/clubs/events", { method: "POST", body: JSON.stringify(input) });
}

/** `PATCH /api/clubs/events/[id]` (manage or coordinator) → `200 { event }`. */
export function updateEvent(id: string, input: UpdateEventInput): Promise<{ event: ClubEvent }> {
    return request(`/api/clubs/events/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
