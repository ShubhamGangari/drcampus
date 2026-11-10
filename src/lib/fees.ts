// ==============================================================================
// Fees Management module (Module 3) — typed frontend API client.
// Mirrors the FROZEN contract for the `/api/fees*` endpoints. All auth-bearing
// calls rely on the HttpOnly `auth_token` cookie set by the portal login route, so
// `fetch` here is same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/fees/payments` → `200 [{ id, invoiceId, invoiceNo, studentId,
//      amount, mode, transactionRef?, receiptNo, createdAt }]`.
//   2. `PUT /api/fees/structures/[id]` → `200 { id, programId, academicYear,
//      semester, components, totalAmount }` (full updated structure).
//   3. `POST /api/fees/structures` → `201 { structureId }`.
//   4. `POST /api/fees/payments` → `201 { paymentId, receiptNo }`.
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface FeeComponent {
  name: string;
  amount: number;
}

/** Row shape returned by `GET /api/fees/structures`. */
export interface FeeStructure {
  id: string;
  programId: string;
  academicYear: string;
  semester: number;
  components: FeeComponent[];
  totalAmount: number;
}

/** Row shape returned by `GET /api/fees/invoices`. */
export interface Invoice {
  id: string;
  invoiceNo: string;
  studentId: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: InvoiceStatus;
}

/** Row shape returned by `GET /api/fees/dues`. */
export interface DueRecord {
  studentId: string;
  name: string;
  rollNo: string;
  totalDue: number;
  lastPaymentDate?: string | null;
}

/** Row shape returned by `GET /api/fees/payments`. */
export interface PaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  studentId: string;
  amount: number;
  mode: string;
  transactionRef?: string | null;
  receiptNo: string;
  createdAt: string;
}

/** Row shape returned by `GET /api/fees/schools` (Central officers). */
export interface SchoolOption {
  id: string;
  name: string;
}

// ---- Request bodies -----------------------------------------------------------

export interface CreateStructureInput {
  programId: string;
  academicYear: string;
  semester: number;
  components: FeeComponent[];
  totalAmount: number;
  /** Required for Central officers (schoolId "ALL"); ignored for school-scoped users. */
  schoolId?: string;
}

export interface GenerateInvoiceInput {
  studentId: string;
  structureId: string;
  dueDate: string;
  /** Required for Central officers (schoolId "ALL"); ignored for school-scoped users. */
  schoolId?: string;
}

export interface CreatePaymentInput {
  invoiceId: string;
  amount: number;
  mode: string;
  transactionRef?: string;
  /** Required for Central officers (schoolId "ALL"); ignored for school-scoped users. */
  schoolId?: string;
}

// ---- Filter shapes ------------------------------------------------------------

export interface StructureFilters {
  programId?: string;
  academicYear?: string;
}

export interface InvoiceFilters {
  studentId?: string;
  status?: InvoiceStatus | "";
}

// ---- Dropdown option sets -----------------------------------------------------

/** Standard 4-year academic-year window around the current date. */
export function academicYearChoices(count = 4): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = year - i;
    out.push(`${start}-${start + 1}`);
  }
  return out;
}

/** Classify a date into an academic-year label (Indian July–June convention). */
export function academicYearOf(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1..12
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export const PAYMENT_MODE_OPTIONS = [
  "UPI",
  "Net Banking",
  "Credit Card",
  "Debit Card",
  "NEFT/RTGS",
  "Cash",
];

// ---- Helpers ------------------------------------------------------------------

export function isFinanceRole(role?: UserRole): boolean {
  // "Finance Admin" per the frozen contract === the Finance Officer role. Central
  // (Registrar) users are treated as able to view too (checked at the page level).
  return role === "FINANCE_OFFICER";
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatAmount(value: number): string {
  return INR.format(value || 0);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function sumComponents(components: FeeComponent[]): number {
  return components.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
}

/** Pure helper: compute the total for a component list (auto-sum in forms). */
export function componentTotal(components: FeeComponent[]): number {
  return sumComponents(components);
}

// ---- Error contract -----------------------------------------------------------

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class FeesApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "FeesApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<FeesApiError> {
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
  return new FeesApiError(res.status, message, code, details);
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

/** POST /api/fees/structures (Finance Admin) → 201 { structureId }. */
export function createStructure(input: CreateStructureInput): Promise<{ structureId: string }> {
  return request("/api/fees/structures", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** PUT /api/fees/structures/[id] (Finance Admin) → 200 full updated FeeStructure. */
export function updateStructure(
  id: string,
  input: CreateStructureInput
): Promise<FeeStructure> {
  return request(`/api/fees/structures/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** GET /api/fees/structures?programId&academicYear (Finance Admin) → FeeStructure[]. */
export function fetchStructures(filters: StructureFilters = {}): Promise<FeeStructure[]> {
  const p = new URLSearchParams();
  if (filters.programId) p.set("programId", filters.programId);
  if (filters.academicYear) p.set("academicYear", filters.academicYear);
  const qs = p.toString();
  return request(`/api/fees/structures${qs ? `?${qs}` : ""}`, { method: "GET" });
}

/** GET /api/fees/schools (Central officers) → SchoolOption[]. */
export function fetchSchools(): Promise<SchoolOption[]> {
  return request("/api/fees/schools", { method: "GET" });
}

/** POST /api/fees/invoices/generate (Finance Admin) → 201 { invoiceId, invoiceNo, amount }. */
export function generateInvoice(input: GenerateInvoiceInput): Promise<{
  invoiceId: string;
  invoiceNo: string;
  amount: number;
}> {
  return request("/api/fees/invoices/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/fees/invoices?studentId&status (Finance Admin/Student) → Invoice[]. */
export function fetchInvoices(filters: InvoiceFilters = {}): Promise<Invoice[]> {
  const p = new URLSearchParams();
  if (filters.studentId) p.set("studentId", filters.studentId);
  if (filters.status) p.set("status", filters.status);
  const qs = p.toString();
  return request(`/api/fees/invoices${qs ? `?${qs}` : ""}`, { method: "GET" });
}

/** POST /api/fees/payments (Finance Admin/Student) → 201 { paymentId, receiptNo }. */
export function createPayment(input: CreatePaymentInput): Promise<{
  paymentId: string;
  receiptNo: string;
}> {
  return request("/api/fees/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * GET /api/fees/payments → 200 PaymentRecord[] (frozen shape 1).
 */
export function fetchPayments(): Promise<PaymentRecord[]> {
  return request("/api/fees/payments", { method: "GET" });
}

/** GET /api/fees/dues?programId (Finance Admin) → DueRecord[]. */
export function fetchDues(programId?: string): Promise<DueRecord[]> {
  const p = new URLSearchParams();
  if (programId) p.set("programId", programId);
  const qs = p.toString();
  return request(`/api/fees/dues${qs ? `?${qs}` : ""}`, { method: "GET" });
}
