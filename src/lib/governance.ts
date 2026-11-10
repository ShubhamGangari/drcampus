// ==============================================================================
// Dean Governance module — typed frontend API client.
// Mirrors the FROZEN contract for `/api/governance/*` endpoints
// (docs/specs/dean-overview.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/governance/overview?schoolId=&departmentId=` → `200 DeanOverview`
//   2. `GET /api/governance/live-classes?schoolId=&departmentId=`
//          → `200 { liveClasses }`
//   3. `GET /api/governance/faculty-presence?schoolId=&departmentId=&date=&userId=`
//          → `200 { items }`
//   4. `POST /api/governance/faculty-presence` → `200 { updated, presence }`
//   5. `POST /api/governance/message` → `200 { sent }`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type PresenceStatus = "PRESENT" | "ABSENT" | "ON_LEAVE" | "UNMARKED";
export type ServerPresenceStatus = Exclude<PresenceStatus, "UNMARKED">;

/** Live/upcoming class row (from `fetchLiveClasses` / overview). */
export interface LiveClassView {
    slotId: string;
    courseId: string;
    courseTitle: string;
    classGroupId: string;
    classLabel: string;
    room: string | null;
    facultyId: string;
    facultyName: string;
    startTime: string;
    endTime: string;
    status: "LIVE" | "UPCOMING";
}

/** Faculty presence row (from `fetchFacultyPresence` / overview). */
export interface FacultyPresenceView {
    userId: string;
    name: string;
    role: string;
    position: string | null;
    departmentId: string | null;
    departmentName: string | null;
    date: string; // YYYY-MM-DD
    status: PresenceStatus;
    markedBy: string | null;
}

export interface DeanKpis {
    facultyCount: number;
    presentToday: number;
    liveClasses: number;
    departmentCount: number;
}

/** Full `GET /api/governance/overview` success payload. */
export interface DeanOverview {
    kpis: DeanKpis;
    liveClasses: LiveClassView[];
    presence: FacultyPresenceView[];
}

// ---- Error contract ------------------------------------------------------------

export interface GovernanceApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class GovernanceApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "GovernanceApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<GovernanceApiError> {
    let message = `Request failed with status ${res.status}`;
    let code: string | undefined;
    let details: unknown;
    try {
        const body = (await res.json()) as GovernanceApiErrorBody;
        if (body?.error?.message) message = body.error.message;
        code = body?.error?.code;
        details = body?.error?.details;
    } catch {
        /* no json body */
    }
    return new GovernanceApiError(res.status, message, code, details);
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

/** `GET /api/governance/overview?schoolId=&departmentId=` → overview. */
export function fetchDeanOverview(
    filters: { schoolId?: string; departmentId?: string } = {}
): Promise<DeanOverview> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.departmentId) p.set("departmentId", filters.departmentId);
    return request(`/api/governance/overview?${p.toString()}`);
}

/** `GET /api/governance/live-classes?schoolId=&departmentId=` → live classes. */
export function fetchLiveClasses(
    filters: { schoolId?: string; departmentId?: string } = {}
): Promise<{ liveClasses: LiveClassView[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.departmentId) p.set("departmentId", filters.departmentId);
    return request(`/api/governance/live-classes?${p.toString()}`);
}

/** `GET /api/governance/faculty-presence` → presence items for a day. */
export function fetchFacultyPresence(
    filters: { schoolId?: string; departmentId?: string; date?: string; userId?: string } = {}
): Promise<{ items: FacultyPresenceView[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.departmentId) p.set("departmentId", filters.departmentId);
    if (filters.date) p.set("date", filters.date);
    if (filters.userId) p.set("userId", filters.userId);
    return request(`/api/governance/faculty-presence?${p.toString()}`);
}

export interface SetPresenceInput {
    schoolId?: string;
    userId: string;
    date: string; // YYYY-MM-DD
    status: ServerPresenceStatus;
}

/**
 * `POST /api/governance/faculty-presence` — upsert a daily presence row.
 * DEAN / REGISTRAR_ADMIN / SUPER_ADMIN may set any faculty; FACULTY self-only.
 */
export function setFacultyPresence(
    input: SetPresenceInput
): Promise<{
    updated: true;
    presence: { userId: string; date: string; status: ServerPresenceStatus; markedBy: string };
}> {
    return request("/api/governance/faculty-presence", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export interface SendMessageInput {
    schoolId?: string;
    recipientUserIds: string[];
    subject: string;
    body?: string;
    link?: string;
}

/** `POST /api/governance/message` → creates a Notification per recipient. */
export function sendMessage(input: SendMessageInput): Promise<{ sent: number }> {
    return request("/api/governance/message", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

// ---- Role helpers -------------------------------------------------------------

/** Roles permitted to open the `/governance` screens. */
export const GOVERNANCE_ROLES: UserRole[] = ["DEAN", "REGISTRAR_ADMIN", "SUPER_ADMIN"];

/** A user may use the governance module if they hold one of the permitted roles. */
export function canAccessGovernance(role?: UserRole): boolean {
    return !!role && GOVERNANCE_ROLES.includes(role);
}

/** Dean / Registrar / Super-admin may manage any faculty's presence. */
export function canManagePresence(role?: UserRole): boolean {
    return role === "DEAN" || role === "REGISTRAR_ADMIN" || role === "SUPER_ADMIN";
}

/** Dean / Registrar / Super-admin may send messages. */
export function canSendMessages(role?: UserRole): boolean {
    return canManagePresence(role);
}

// ---- Date helpers (IS timezone) ----------------------------------------------

const IST_TZ = "Asia/Kolkata";

/** Today's date as `YYYY-MM-DD` in IST. */
export function todayIST(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: IST_TZ });
}

/** The last `n` calendar days as `YYYY-MM-DD` (oldest → newest), in IST. */
export function lastNDays(n: number): string[] {
    const out: string[] = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        out.push(d.toLocaleDateString("en-CA", { timeZone: IST_TZ }));
    }
    return out;
}

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `YYYY-MM-DD` → `Mon d` (e.g. `Nov 10`). */
export function formatDisplayDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    return `${MONTHS[m - 1]} ${d}`;
}

/** Human label for a presence status (used for badges/legends). */
export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
    PRESENT: "Present",
    ABSENT: "Absent",
    ON_LEAVE: "On leave",
    UNMARKED: "Unmarked",
};
