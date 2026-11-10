// ==============================================================================
// Dynamic RBAC Admin Console (Module: Dynamic RBAC) — typed frontend API client.
// Mirrors the FROZEN contract for the `/api/rbac*` endpoints (spec §4). All
// endpoints are SUPER_ADMIN only; auth rides the HttpOnly `auth_token` cookie
// like every other module, so `fetch` here is same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/rbac/permissions` → `200 { areas: [{ name, permissions:[{key,label}] }] }`
//   2. `GET /api/rbac/roles?schoolId=` → `200 { roles: [{ id, name, description,
//      schoolId, permissions, userCount, createdAt }] }`
//   3. `POST /api/rbac/roles` → `201 { role }`; `PATCH /api/rbac/roles/[id]` → `200 { role }`
//   4. `DELETE /api/rbac/roles/[id]` → `200 { success: true }` (409 ROLE_IN_USE if assigned)
//   5. `GET /api/rbac/users?q=&role=&schoolId=&customRoleId=` → `200 { users: [...] }`
//   6. `POST /api/rbac/users` → `201 { user }`; `PATCH /api/rbac/users/[id]` → `200 { user }`
// ==============================================================================

import type { Permission } from "./perms";
import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

/** Row shape returned by `GET /api/rbac/roles`. */
export interface RbacRole {
    id: string;
    name: string;
    description: string | null;
    schoolId: string | null; // null = global role
    permissions: Permission[];
    userCount: number;
    createdAt: string;
}

/** Row shape returned by `GET /api/rbac/users`. */
export interface RbacUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    position: string | null;
    schoolId: string;
    customRoleId: string | null;
    active: boolean;
}

/** Grouped catalog area returned by `GET /api/rbac/permissions` / perms catalog. */
export interface CatalogPermission {
    key: Permission;
    label: string;
}

export interface CatalogArea {
    name: string;
    permissions: CatalogPermission[];
}

// ---- Dropdown option sets -----------------------------------------------------

/** The 6 built-in roles (excludes SUPER_ADMIN) an officer may be assigned. */
export const BUILTIN_ROLES = [
    "FACULTY",
    "FINANCE_OFFICER",
    "EXAM_CONTROLLER",
    "DEAN",
    "STUDENT",
    "REGISTRAR_ADMIN",
] as const;

export type BuiltinRole = (typeof BUILTIN_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
    FACULTY: "Faculty",
    FINANCE_OFFICER: "Finance Officer",
    EXAM_CONTROLLER: "Exam Controller",
    DEAN: "Dean",
    STUDENT: "Student",
    REGISTRAR_ADMIN: "Registrar Admin",
    SUPER_ADMIN: "Super Admin",
};

export const POSITION_LABELS: Record<string, string> = {
    SUBJECT_TEACHER: "Subject Teacher",
    CLASS_COORDINATOR: "Class Coordinator",
    HOD: "Head of Department",
    EXAM_CELL_CLERK: "Exam Cell Clerk",
    HOSTEL_ADMIN: "Hostel Admin",
    ADMISSIONS_OFFICER: "Admissions Officer",
    PROGRAM_COORDINATOR: "Program Coordinator",
    DEPARTMENT_SECRETARY: "Department Secretary",
};

// ---- Request bodies -----------------------------------------------------------

export interface CreateRoleInput {
    schoolId?: string | null;
    name: string;
    description?: string | null;
    permissions: string[];
}

export interface UpdateRoleInput {
    name?: string;
    description?: string | null;
    permissions?: string[];
}

export interface CreateOfficerInput {
    schoolId: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
    position?: string | null;
    customRoleId?: string | null;
}

export interface UpdateOfficerInput {
    role?: UserRole;
    position?: string | null;
    customRoleId?: string | null;
    active?: boolean;
}

export interface RbacUserFilters {
    q?: string;
    role?: string;
    schoolId?: string;
    customRoleId?: string;
}

// ---- Error contract -----------------------------------------------------------

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export class RbacApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "RbacApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<RbacApiError> {
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
    return new RbacApiError(res.status, message, code, details);
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

// ---- API functions (mirror the frozen contract) -------------------------------

/** GET /api/rbac/permissions → grouped catalog for the UI. */
export function fetchPermissionCatalog(): Promise<{ areas: CatalogArea[] }> {
    return request("/api/rbac/permissions", { method: "GET" });
}

/** GET /api/rbac/roles?schoolId= → roles (global + school-scoped). */
export function fetchRoles(schoolId?: string): Promise<{ roles: RbacRole[] }> {
    const p = new URLSearchParams();
    if (schoolId) p.set("schoolId", schoolId);
    const qs = p.toString();
    return request(`/api/rbac/roles${qs ? `?${qs}` : ""}`, { method: "GET" });
}

/** POST /api/rbac/roles → 201 { role }. */
export function createRole(input: CreateRoleInput): Promise<{ role: RbacRole }> {
    return request("/api/rbac/roles", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** PATCH /api/rbac/roles/[id] → 200 { role }. Scope (schoolId) is immutable. */
export function updateRole(id: string, input: UpdateRoleInput): Promise<{ role: RbacRole }> {
    return request(`/api/rbac/roles/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** DELETE /api/rbac/roles/[id] → 200 { success: true } (409 if in use). */
export function deleteRole(id: string): Promise<{ success: true }> {
    return request(`/api/rbac/roles/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** GET /api/rbac/users?q=&role=&schoolId=&customRoleId= → officer list. */
export function fetchUsers(filters: RbacUserFilters = {}): Promise<{ users: RbacUser[] }> {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.role) p.set("role", filters.role);
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.customRoleId) p.set("customRoleId", filters.customRoleId);
    const qs = p.toString();
    return request(`/api/rbac/users${qs ? `?${qs}` : ""}`, { method: "GET" });
}

/** POST /api/rbac/users → create an officer account → 201 { user }. */
export function createOfficer(input: CreateOfficerInput): Promise<{ user: RbacUser }> {
    return request("/api/rbac/users", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** PATCH /api/rbac/users/[id] → update role / position / custom role / active → 200 { user }. */
export function updateOfficer(id: string, input: UpdateOfficerInput): Promise<{ user: RbacUser }> {
    return request(`/api/rbac/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
