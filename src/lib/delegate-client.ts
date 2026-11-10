// ==============================================================================
// Delegated Account Creation (Module: Delegated Accounts & Hierarchy) — typed
// frontend API client. Mirrors the FROZEN contract for the `/api/accounts*`
// endpoints (spec §4). Auth rides the HttpOnly `auth_token` cookie like every
// other module, so `fetch` here is same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/accounts/capabilities` → `200 { canCreate,
//      scope: { schoolId, departmentId, scopeLabel },
//      roles: [{ role, label, positions }],
//      departments?: [{ id, name }] }` (departments only for
//      SUPER_ADMIN / REGISTRAR_ADMIN)
//   2. `POST /api/accounts` body `{ schoolId?, name, email, password, role,
//      position?, departmentId? }` → `201 { user: { id, name, email, role,
//      position, departmentId, schoolId, active } }`; server recomputes
//      `canDelegate(actor, target)` → `403 FORBIDDEN` when out of scope,
//      `409 EMAIL_EXISTS`, `400`, `404 SCHOOL_NOT_FOUND`/`DEPARTMENT_NOT_FOUND`.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) -------------------------------------

/** A role the current user is allowed to create (from capabilities). */
export interface DelegateCapabilityRole {
    role: UserRole;
    label: string;
    positions: string[];
}

/** Delegation scope for the current user. */
export interface DelegateScope {
    schoolId: string;
    departmentId: string | null;
    scopeLabel: string;
}

/** Response of `GET /api/accounts/capabilities`. */
export interface AccountCapabilities {
    canCreate: boolean;
    scope: DelegateScope;
    roles: DelegateCapabilityRole[];
    departments?: Array<{ id: string; name: string }>;
}

/** Created user row returned by `POST /api/accounts`. */
export interface CreatedAccount {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    position: string | null;
    departmentId: string | null;
    schoolId: string;
    active: boolean;
}

// ---- Request body -----------------------------------------------------------

export interface CreateAccountInput {
    schoolId?: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
    position?: string | null;
    departmentId?: string | null;
}

// ---- Error contract ---------------------------------------------------------

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class DelegateApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "DelegateApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<DelegateApiError> {
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
    return new DelegateApiError(res.status, message, code, details);
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
    if (res.status === 204) {
        return undefined as T;
    }
    return (await res.json()) as T;
}

// ---- API functions (mirror the frozen contract) -----------------------------

/** GET /api/accounts/capabilities → what the current user may create + scope. */
export function fetchAccountCapabilities(): Promise<AccountCapabilities> {
    return request("/api/accounts/capabilities", { method: "GET" });
}

/** POST /api/accounts → create a delegated account → 201 { user }. */
export function createAccount(input: CreateAccountInput): Promise<{ user: CreatedAccount }> {
    return request("/api/accounts", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
