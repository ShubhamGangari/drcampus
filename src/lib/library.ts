// ==============================================================================
// Library Management module (Batch A) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/library*` endpoints
// (docs/specs/library.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/library/books?schoolId=&search=` → `200 { books }`
//   2. `POST /api/library/books` → `201 { book }`
//   3. `PATCH /api/library/books/[id]` → `200 { book }`
//   4. `DELETE /api/library/books/[id]` → `200 { success: true }`
//   5. `GET /api/library/loans?memberId=&status=` → `200 { loans }`
//   6. `POST /api/library/loans` → `201 { loan }`
//   7. `POST /api/library/loans/[id]/return` → `200 { loan }`
//   8. `GET /api/library/memberships` → `200 { memberships }`
//   9. `POST /api/library/memberships` → `201 { membership }`
//  10. `PATCH /api/library/memberships/[userId]` → `200 { membership }`
//  11. `GET /api/library/fines` → `200 { fines }`
//  12. `POST /api/library/fines/[id]/pay` → `200 { fine }`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export interface LibraryBook {
    id: string;
    accessionNo: string;
    title: string;
    author: string;
    isbn: string | null;
    category: string | null;
    totalCopies: number;
    availableCopies: number;
    shelf: string | null;
}

export interface LibraryCopy {
    id: string;
    accessionNo: string;
    available: boolean;
}

export type LoanStatus = "ISSUED" | "OVERDUE" | "RETURNED";
export type FineStatus = "UNPAID" | "PAID";

export interface LibraryLoan {
    id: string;
    copyId: string;
    bookTitle: string;
    memberId: string;
    memberName: string;
    issueDate: string;
    dueDate: string;
    returnDate: string | null;
    status: LoanStatus;
    fine: number;
    fineStatus: FineStatus;
}

export interface LibraryMembership {
    id: string;
    userId: string;
    name: string;
    email: string;
    type: "STUDENT" | "STAFF";
    active: boolean;
    outstandingFine: number;
}

export interface LibraryFine {
    id: string;
    loanId: string;
    memberId: string;
    daysOverdue: number;
    amount: number;
    status: FineStatus;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateBookInput {
    schoolId?: string;
    title: string;
    author: string;
    isbn?: string | null;
    category?: string | null;
    shelf?: string | null;
    totalCopies?: number;
}

export type UpdateBookInput = Partial<
    Omit<CreateBookInput, "schoolId"> & { schoolId?: string }
>;

export interface IssueLoanInput {
    schoolId?: string;
    memberId: string;
    copyId: string;
    dueDate?: string;
}

export interface ReturnLoanInput {
    fine?: number;
}

export interface CreateMembershipInput {
    schoolId?: string;
    userId: string;
    type?: "STUDENT" | "STAFF";
}

export interface UpdateMembershipInput {
    active?: boolean;
    type?: "STUDENT" | "STAFF";
}

// ---- Form option constants ---------------------------------------------------

export const MEMBERSHIP_TYPES = ["STUDENT", "STAFF"] as const;

// ---- Role helpers (spec §2) --------------------------------------------------

/** Every authenticated user gets self-service access (their own loans/fines + catalogue). */
export function canAccessLibrary(user?: { role?: UserRole } | null): boolean {
    return !!user?.role;
}

/**
 * Can this role manage the library (catalogue writes, issue/return, membership
 * admin, fine payment)? Students are self-service only. The backend enforces
 * the actual `library.manage` permission for custom roles — this drives UI only.
 */
export function canManageLibrary(role?: UserRole): boolean {
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

export class LibraryApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "LibraryApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<LibraryApiError> {
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
    return new LibraryApiError(res.status, message, code, details);
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

/** `GET /api/library/books?schoolId=&search=` → `{ books }`. */
export function fetchBooks(
    filters: { schoolId?: string; search?: string } = {}
): Promise<{ books: LibraryBook[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.search) p.set("search", filters.search);
    const qs = p.toString();
    return request(`/api/library/books${qs ? `?${qs}` : ""}`);
}

/** `POST /api/library/books` (library.manage) → `201 { book }`. */
export function createBook(input: CreateBookInput): Promise<{ book: LibraryBook }> {
    return request("/api/library/books", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/library/books/[id]` (library.manage) → `200 { book }`. */
export function updateBook(id: string, input: UpdateBookInput): Promise<{ book: LibraryBook }> {
    return request(`/api/library/books/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `DELETE /api/library/books/[id]` (library.manage) → `200 { success: true }`. */
export function deleteBook(id: string): Promise<{ success: boolean }> {
    return request(`/api/library/books/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** `GET /api/library/books/[id]/copies` → `{ copies }` (read-only, tenants). */
export function fetchBookCopies(bookId: string): Promise<{ copies: LibraryCopy[] }> {
    return request(`/api/library/books/${encodeURIComponent(bookId)}/copies`);
}

/** `GET /api/library/loans?memberId=&status=` → `{ loans }`. */
export function fetchLoans(
    filters: { schoolId?: string; memberId?: string; status?: LoanStatus } = {}
): Promise<{ loans: LibraryLoan[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    if (filters.memberId) p.set("memberId", filters.memberId);
    if (filters.status) p.set("status", filters.status);
    const qs = p.toString();
    return request(`/api/library/loans${qs ? `?${qs}` : ""}`);
}

/** `POST /api/library/loans` (library.manage, issue) → `201 { loan }`. */
export function issueLoan(input: IssueLoanInput): Promise<{ loan: LibraryLoan }> {
    return request("/api/library/loans", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `POST /api/library/loans/[id]/return` (library.manage) → `200 { loan }`. */
export function returnLoan(id: string, input?: ReturnLoanInput): Promise<{ loan: LibraryLoan }> {
    return request(`/api/library/loans/${encodeURIComponent(id)}/return`, {
        method: "POST",
        body: JSON.stringify(input ?? {}),
    });
}

/** `GET /api/library/memberships` → `{ memberships }`. */
export function fetchMemberships(
    filters: { schoolId?: string } = {}
): Promise<{ memberships: LibraryMembership[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    const qs = p.toString();
    return request(`/api/library/memberships${qs ? `?${qs}` : ""}`);
}

/** `POST /api/library/memberships` (library.manage) → `201 { membership }`. */
export function createMembership(
    input: CreateMembershipInput
): Promise<{ membership: LibraryMembership }> {
    return request("/api/library/memberships", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** `PATCH /api/library/memberships/[userId]` (library.manage) → `200 { membership }`. */
export function updateMembership(
    userId: string,
    input: UpdateMembershipInput
): Promise<{ membership: LibraryMembership }> {
    return request(`/api/library/memberships/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** `GET /api/library/fines` → `{ fines }`. */
export function fetchFines(
    filters: { schoolId?: string } = {}
): Promise<{ fines: LibraryFine[] }> {
    const p = new URLSearchParams();
    if (filters.schoolId) p.set("schoolId", filters.schoolId);
    const qs = p.toString();
    return request(`/api/library/fines${qs ? `?${qs}` : ""}`);
}

/** `POST /api/library/fines/[id]/pay` (library.manage) → `200 { fine }`. */
export function payFine(id: string): Promise<{ fine: LibraryFine }> {
    return request(`/api/library/fines/${encodeURIComponent(id)}/pay`, { method: "POST" });
}
