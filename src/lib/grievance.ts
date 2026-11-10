// ==============================================================================
// Grievance & Helpdesk module (Batch B) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/grievance*` endpoints
// (docs/specs/grievance.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types ------------------------------------------------------------------

export const GRIEVANCE_CATEGORIES = [
    "ACADEMIC",
    "HOSTEL",
    "FEES",
    "TRANSPORT",
    "GENERAL",
] as const;
export type GrievanceCategory = (typeof GRIEVANCE_CATEGORIES)[number];

export const GRIEVANCE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type GrievancePriority = (typeof GRIEVANCE_PRIORITIES)[number];

export const GRIEVANCE_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type GrievanceStatus = (typeof GRIEVANCE_STATUSES)[number];

export interface GrievanceTicket {
    id: string;
    ticketNo: string;
    category: string;
    subject: string;
    status: GrievanceStatus;
    priority: GrievancePriority;
    assigneeUserId: string | null;
    resolution: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface GrievanceMessage {
    id: string;
    authorName: string;
    body: string;
    createdAt: string;
}

export interface GrievanceDetail {
    ticket: GrievanceTicket;
    messages: GrievanceMessage[];
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateTicketInput {
    schoolId?: string;
    category: string;
    subject: string;
    description: string;
    priority?: GrievancePriority;
}

export interface UpdateTicketInput {
    status?: GrievanceStatus;
    priority?: GrievancePriority;
    assigneeUserId?: string | null;
    resolution?: string;
}

// ---- Role helpers ------------------------------------------------------------

const MANAGE_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Every authenticated user can raise tickets and track their own. */
export function canAccessGrievance(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    return !!user?.role;
}

/** Full helpdesk management (triage / assign / respond / resolve). */
export function canManageGrievance(user?: { role?: UserRole; permissions?: string[] } | null): boolean {
    if (!user?.role) return false;
    if (user.permissions?.includes("grievance.manage")) return true;
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

export class GrievanceApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "GrievanceApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<GrievanceApiError> {
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
    return new GrievanceApiError(res.status, message, code, details);
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

/** `GET /api/grievance?status=&category=&mine=` → `{ tickets }`. */
export function fetchTickets(
    filters: { schoolId?: string; status?: string; category?: string; mine?: boolean } = {}
): Promise<{ tickets: GrievanceTicket[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.status) p.set("status", filters.status);
    if (filters.category) p.set("category", filters.category);
    if (filters.mine) p.set("mine", "true");
    const qs = p.toString();
    return request(`/api/grievance${qs ? `?${qs}` : ""}`);
}

/** `POST /api/grievance` (any authenticated) → `201 { ticket }`. */
export function createTicket(input: CreateTicketInput): Promise<{ ticket: GrievanceTicket }> {
    return request("/api/grievance", { method: "POST", body: JSON.stringify(input) });
}

/** `GET /api/grievance/[id]` → `{ ticket, messages }`. */
export function fetchTicket(id: string): Promise<GrievanceDetail> {
    return request(`/api/grievance/${encodeURIComponent(id)}`);
}

/** `POST /api/grievance/[id]/messages` → `201 { message }`. */
export function replyTicket(id: string, body: { body: string }): Promise<{ message: GrievanceMessage }> {
    return request(`/api/grievance/${encodeURIComponent(id)}/messages`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

/** `PATCH /api/grievance/[id]` (grievance.manage) → `200 { ticket }`. */
export function updateTicket(id: string, input: UpdateTicketInput): Promise<{ ticket: GrievanceTicket }> {
    return request(`/api/grievance/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
