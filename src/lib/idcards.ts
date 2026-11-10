// ==============================================================================
// ID Cards — client API (Batch E). Mirrors docs/specs/id-cards.md §4.
// Central officers (schoolId 'ALL') must pass `schoolId` to scope requests;
// school-scoped users omit it (server auto-scopes).
// ==============================================================================

export type CardStatus = "ACTIVE" | "REVOKED";
export type HolderType = "STUDENT" | "STAFF";

export interface IdentityCardShape {
    id: string;
    holderId: string;
    holderName: string;
    holderType: HolderType;
    cardNumber: string;
    status: CardStatus;
    issuedAt: string;
}

export interface GenerateIdCardsInput {
    holderType: HolderType;
    studentIds?: string[];
    staffIds?: string[];
    batchId?: string;
    schoolId?: string;
}

export interface ApiErrorBody {
    error?: { code?: string; message?: string; details?: unknown };
}

export class IdCardsApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = "IdCardsApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseError(res: Response): Promise<IdCardsApiError> {
    let code: string | undefined;
    let details: unknown;
    let message = res.statusText || "Request failed";
    try {
        const body = (await res.json()) as ApiErrorBody;
        code = body.error?.code;
        message = body.error?.message || message;
        details = body.error?.details;
    } catch {
        /* ignore non-JSON bodies */
    }
    return new IdCardsApiError(res.status, message, code, details);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
}

export function fetchIdCards(params?: {
    status?: CardStatus;
    type?: HolderType;
    schoolId?: string;
}): Promise<{ cards: IdentityCardShape[] }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    if (params?.schoolId) qs.set("schoolId", params.schoolId);
    const q = qs.toString();
    return request<{ cards: IdentityCardShape[] }>(`/api/idcards${q ? `?${q}` : ""}`);
}

export function generateIdCards(input: GenerateIdCardsInput): Promise<{ cards: IdentityCardShape[] }> {
    return request<{ cards: IdentityCardShape[] }>("/api/idcards/generate", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function fetchMyCard(): Promise<{ card: IdentityCardShape }> {
    return request<{ card: IdentityCardShape }>("/api/idcards/my");
}

export function revokeIdCard(id: string, schoolId?: string): Promise<{ card: IdentityCardShape }> {
    const q = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
    return request<{ card: IdentityCardShape }>(`/api/idcards/${id}/revoke${q}`, {
        method: "POST",
    });
}
