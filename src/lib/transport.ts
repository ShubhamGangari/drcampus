// ==============================================================================
// Transport Management module (Batch A) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/transport*` endpoints
// (docs/specs/transport.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export interface RouteStop {
    name: string;
    order: number;
    time?: string | null;
}

export interface TransportRoute {
    id: string;
    name: string;
    stops: RouteStop[];
    distanceKm: number | null;
    active: boolean;
}

export type VehicleType = "BUS" | "VAN";
export type VehicleStatus = "ACTIVE" | "MAINTENANCE";

export interface TransportVehicle {
    id: string;
    registrationNo: string;
    type: VehicleType;
    capacity: number;
    routeId: string | null;
    routeName: string | null;
    status: VehicleStatus;
}

export type PassStatus = "ACTIVE" | "EXPIRED" | "PENDING";

export interface TransportPass {
    id: string;
    studentId: string;
    studentName: string;
    rollNo: string | null;
    routeId: string;
    routeName: string;
    routeStops: RouteStop[];
    stop: string;
    validFrom: string;
    validTo: string;
    fee: number;
    status: PassStatus;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateRouteInput {
    schoolId?: string;
    name: string;
    stops: RouteStop[];
    distanceKm?: number | null;
}

export type UpdateRouteInput = Partial<CreateRouteInput & { active: boolean }>;

export interface CreateVehicleInput {
    schoolId?: string;
    registrationNo: string;
    type?: VehicleType;
    capacity: number;
    routeId?: string | null;
    status?: VehicleStatus;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export interface CreatePassInput {
    schoolId?: string;
    studentId: string;
    routeId: string;
    stop: string;
    validTo: string;
    fee: number;
}

export interface UpdatePassInput {
    status?: PassStatus;
}

// ---- Form option constants ---------------------------------------------------

export const VEHICLE_TYPES = ["BUS", "VAN"] as const;
export const VEHICLE_STATUSES = ["ACTIVE", "MAINTENANCE"] as const;
export const PASS_STATUSES = ["ACTIVE", "EXPIRED", "PENDING"] as const;

// ---- Role helpers (spec §2) --------------------------------------------------

/** Every authenticated user gets read access to the route network. */
export function canAccessTransport(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Students are self-service (their own pass) — no management rights. */
export function canManageTransport(role?: UserRole): boolean {
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

export class TransportApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "TransportApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<TransportApiError> {
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
    return new TransportApiError(res.status, message, code, details);
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

// ---- Endpoint wrappers (one per frozen contract endpoint) -----------------------

/** `GET /api/transport/routes?schoolId=` → `{ routes }`. */
export function fetchRoutes(
    filters: { schoolId?: string } = {}
): Promise<{ routes: TransportRoute[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    const qs = p.toString();
    return request(`/api/transport/routes${qs ? `?${qs}` : ""}`);
}

/** `POST /api/transport/routes` (transport.manage) → `201 { route }`. */
export function createRoute(input: CreateRouteInput): Promise<{ route: TransportRoute }> {
    return request("/api/transport/routes", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/transport/routes/[id]` (transport.manage) → `200 { route }`. */
export function updateRoute(id: string, input: UpdateRouteInput): Promise<{ route: TransportRoute }> {
    return request(`/api/transport/routes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `DELETE /api/transport/routes/[id]` (transport.manage) → `200 { success }`. */
export function deleteRoute(id: string): Promise<{ success: boolean }> {
    return request(`/api/transport/routes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** `GET /api/transport/vehicles?schoolId=` → `{ vehicles }`. */
export function fetchVehicles(
    filters: { schoolId?: string } = {}
): Promise<{ vehicles: TransportVehicle[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    const qs = p.toString();
    return request(`/api/transport/vehicles${qs ? `?${qs}` : ""}`);
}

/** `POST /api/transport/vehicles` (transport.manage) → `201 { vehicle }`. */
export function createVehicle(input: CreateVehicleInput): Promise<{ vehicle: TransportVehicle }> {
    return request("/api/transport/vehicles", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/transport/vehicles/[id]` (transport.manage) → `200 { vehicle }`. */
export function updateVehicle(
    id: string,
    input: UpdateVehicleInput
): Promise<{ vehicle: TransportVehicle }> {
    return request(`/api/transport/vehicles/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `DELETE /api/transport/vehicles/[id]` (transport.manage) → `200 { success }`. */
export function deleteVehicle(id: string): Promise<{ success: boolean }> {
    return request(`/api/transport/vehicles/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** `GET /api/transport/passes?studentId=&schoolId=` → `{ passes }`. */
export function fetchPasses(
    filters: { schoolId?: string; studentId?: string } = {}
): Promise<{ passes: TransportPass[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.studentId) p.set("studentId", filters.studentId);
    const qs = p.toString();
    return request(`/api/transport/passes${qs ? `?${qs}` : ""}`);
}

/** `POST /api/transport/passes` (transport.manage, issue) → `201 { pass }`. */
export function issuePass(input: CreatePassInput): Promise<{ pass: TransportPass }> {
    return request("/api/transport/passes", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/transport/passes/[id]` (transport.manage) → `200 { pass }`. */
export function updatePass(id: string, input: UpdatePassInput): Promise<{ pass: TransportPass }> {
    return request(`/api/transport/passes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
