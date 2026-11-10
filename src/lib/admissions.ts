// ==============================================================================
// Admissions module — typed frontend API client.
// Mirrors the frozen contract in docs/specs/admissions.md (the spec file lives
// with the architect; this module is the single client-side source of truth).
// All auth-bearing calls rely on the HttpOnly `auth_token` cookie set by the
// portal login route, so `fetch` here is same-origin without manual headers.
// ==============================================================================

// ---- Types (shapes returned by the backend) --------------------------------

export interface AdmissionCycle {
  id: string;
  title: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  active: boolean;
  _count?: { applications: number };
  createdAt?: string;
}

export interface CycleApplicationCount {
  applications: number;
}

// Public (unauthenticated) cycle shape returned by the public apply endpoint —
// only `id`, `title` and `academicYear` are exposed to avoid cross-tenant leakage.
export interface PublicAdmissionCycle {
  id: string;
  title: string;
  academicYear: string;
}

export type ApplicationStatus =
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED"
  | "SHORTLISTED"
  | "ADMITTED";

export interface ApplicantDocument {
  name: string;
  url: string;
}

export interface ApplicationRecord {
  id: string;
  schoolId: string;
  cycleId: string;
  cycle?: { title: string; academicYear: string };
  applicationNo: string;
  programId: string;
  applicantName: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
  category: string;
  marksPercentage: number;
  documentsJson?: string;
  status: ApplicationStatus;
  meritRank?: number | null;
  remarks?: string | null;
  createdAt?: string;
}

export interface NewApplicationResult {
  application: {
    id: string;
    applicationNo: string;
    status: ApplicationStatus;
  };
}

export interface MeritResult {
  totalRanked: number;
  programId: string;
  generatedAt: string;
}

export interface PublishMeritResult {
  published: true;
  publishedAt: string;
  cycleId: string;
  programId: string;
}

export interface SeatAllocationResult {
  applicationId: string;
  seatAllocated: boolean;
  provisionalRollNo?: string | null;
}

// ---- Request bodies ----------------------------------------------------------

export interface CreateCycleInput {
  title: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  active: boolean;
  /** Central officers only: the schoolId of the school this cycle belongs to. */
  schoolId?: string;
}

export interface SubmitApplicationInput {
  schoolId: string;
  cycleId: string;
  programId: string;
  applicantName: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
  category: string;
  marksPercentage: number;
  documents: ApplicantDocument[];
}

export interface UpdateApplicationStatusInput {
  status: Exclude<ApplicationStatus, "SUBMITTED">;
  remarks?: string;
}

export interface GenerateMeritInput {
  cycleId: string;
  programId: string;
  formula: "MARKS_PERCENTAGE";
}

export interface AllocateSeatInput {
  applicationId: string;
  programId: string;
  quotaCategory: string;
}

export interface ApplicationFilters {
  cycleId?: string;
  programId?: string;
  status?: ApplicationStatus | "";
  search?: string;
}

// ---- Error contract ---------------------------------------------------------

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class AdmissionsApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "AdmissionsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<AdmissionsApiError> {
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
  return new AdmissionsApiError(res.status, message, code, details);
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

// ---- Endpoint wrappers ------------------------------------------------------

export function fetchCycles(): Promise<{ cycles: AdmissionCycle[] }> {
  return request("/api/admissions/cycles", { method: "GET" });
}

// Public (unauthenticated) active admission cycles for the public apply page.
// This endpoint is allowlisted in middleware and scoped to the `schoolId` query
// param, so it never requires an authenticated session.
export function fetchPublicCycles(
  schoolId: string
): Promise<{ cycles: PublicAdmissionCycle[] }> {
  return request(`/api/admissions/public/cycles?schoolId=${encodeURIComponent(schoolId)}`, {
    method: "GET",
  });
}

export function createCycle(input: CreateCycleInput): Promise<{ cycle: AdmissionCycle }> {
  return request("/api/admissions/cycles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchApplications(
  filters: ApplicationFilters = {}
): Promise<{ applications: ApplicationRecord[] }> {
  const params = new URLSearchParams();
  if (filters.cycleId) params.set("cycleId", filters.cycleId);
  if (filters.programId) params.set("programId", filters.programId);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return request(`/api/admissions/applications${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export function submitApplication(
  input: SubmitApplicationInput
): Promise<NewApplicationResult> {
  return request("/api/admissions/applications", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateApplicationStatus(
  id: string,
  input: UpdateApplicationStatusInput
): Promise<{ id: string; status: ApplicationStatus; remarks?: string | null }> {
  return request(`/api/admissions/applications/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function generateMeritList(input: GenerateMeritInput): Promise<MeritResult> {
  return request("/api/admissions/merit-list/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function publishMeritList(cycleId: string, programId: string): Promise<PublishMeritResult> {
  return request("/api/admissions/merit-list/publish", {
    method: "POST",
    body: JSON.stringify({ cycleId, programId }),
  });
}

export function allocateSeat(input: AllocateSeatInput): Promise<SeatAllocationResult> {
  return request("/api/admissions/allocate-seat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
