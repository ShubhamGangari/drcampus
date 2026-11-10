// ==============================================================================
// Certificates & Documents module (Batch A) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/certificates*` endpoints
// (docs/specs/certificates.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers. The verify endpoint is public (no auth);
// download returns printable HTML opened in a new tab.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type CertificateType =
    | "TC"
    | "MIGRATION"
    | "CHARACTER"
    | "BONAFIDE"
    | "PROVISIONAL_DEGREE";

export type CertificateStatus =
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "ISSUED";

export interface Certificate {
    id: string;
    schoolId: string;
    studentId: string;
    studentName: string | null;
    studentRollNo: string | null;
    type: CertificateType;
    purpose: string | null;
    status: CertificateStatus;
    remark: string | null;
    requestNo: string;
    referenceNo: string | null;
    issuedAt: string | null;
    createdAt: string;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateCertificateInput {
    type: CertificateType;
    purpose?: string;
}

export interface UpdateCertificateInput {
    status: "APPROVED" | "REJECTED" | "ISSUED";
    remark?: string;
}

// ---- Form option constants ---------------------------------------------------

export const CERTIFICATE_TYPES = [
    "TC",
    "MIGRATION",
    "CHARACTER",
    "BONAFIDE",
    "PROVISIONAL_DEGREE",
] as const;

export const CERTIFICATE_STATUSES = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "ISSUED",
] as const;

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
    TC: "Transfer Certificate",
    MIGRATION: "Migration Certificate",
    CHARACTER: "Character Certificate",
    BONAFIDE: "Bonafide Certificate",
    PROVISIONAL_DEGREE: "Provisional Degree",
};

// ---- Role helpers (spec §2) --------------------------------------------------

/**
 * Every authenticated user gets self-service access (request + download their own
 * certificates + verify page is public and therefore outside this gate).
 */
export function canAccessCertificates(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/** Students are self-service only — no approve/reject/issue rights. */
export function canManageCertificates(role?: UserRole): boolean {
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

export class CertificatesApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "CertificatesApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<CertificatesApiError> {
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
    return new CertificatesApiError(res.status, message, code, details);
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

/** `GET /api/certificates?status=` (self) → `{ certificates }`. */
export function fetchMyCertificates(
    filters: { status?: CertificateStatus } = {}
): Promise<{ certificates: Certificate[] }> {
    const p = new URLSearchParams();
    if (filters.status) p.set("status", filters.status);
    const qs = p.toString();
    return request(`/api/certificates${qs ? `?${qs}` : ""}`);
}

/**
 * `GET /api/certificates?all=true&schoolId=&status=` (certificates.manage/view)
 * → `{ certificates }` — the whole queue for the tenant.
 */
export function fetchAllCertificates(
    filters: { schoolId?: string; status?: CertificateStatus } = {}
): Promise<{ certificates: Certificate[] }> {
    const p = new URLSearchParams();
    p.set("all", "true");
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.status) p.set("status", filters.status);
    const qs = p.toString();
    return request(`/api/certificates${qs ? `?${qs}` : ""}`);
}

/** `POST /api/certificates` (student/alumni) → `201 { certificate }`. */
export function requestCertificate(
    input: CreateCertificateInput
): Promise<{ certificate: Certificate }> {
    return request("/api/certificates", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/certificates/[id]` (certificates.manage) → `200 { certificate }`. */
export function updateCertificate(
    id: string,
    input: UpdateCertificateInput
): Promise<{ certificate: Certificate }> {
    return request(`/api/certificates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `GET /api/certificates/[id]/download` — owner/manager, printable HTML. */
export function certificateDownloadUrl(id: string): string {
    return `/api/certificates/${encodeURIComponent(id)}/download`;
}

/** `GET /api/certificates/verify?code=` (public) → `200 { valid, ... }`. */
export function verifyCertificate(
    code: string
): Promise<{
    valid: boolean;
    type: CertificateType;
    studentName: string | null;
    issuedDate: string | null;
    referenceNo: string | null;
}> {
    const p = new URLSearchParams();
    p.set("code", code);
    return request(`/api/certificates/verify?${p.toString()}`);
}
