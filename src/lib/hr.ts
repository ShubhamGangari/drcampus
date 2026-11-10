// ==============================================================================
// HR & Payroll module (Module 9) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/hr*` endpoints
// (docs/specs/hr-payroll.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/hr/employees?schoolId=` → `200 Employee[]`
//   2. `POST /api/hr/employees` → `201 { id }`
//   3. `GET /api/hr/employees/me` → `200 Employee` | `404`
//   4. `POST /api/hr/leave` → `201 { requestId }`
//   5. `GET /api/hr/leave?schoolId=` → `200 LeaveRequest[]`
//   6. `PATCH /api/hr/leave/[id]` → `200 { id, status }`
//   7. `POST /api/hr/payroll/generate` → `201 { payrollId }`
//   8. `GET /api/hr/payroll?schoolId=&month=` → `200 PayrollRecord[]`
//   9. `POST /api/hr/payroll/[id]/approve` → `200 { id, status }`
//  10. `GET /api/hr/payslip?month=` → `200 Payslip` | `404`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

/** Row shape returned by `GET /api/hr/employees` / `GET /api/hr/employees/me`. */
export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  userId: string;
}

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Row shape returned by `GET /api/hr/leave`. */
export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  fromDate: string;
  toDate: string;
  type: string;
  status: LeaveStatus;
}

export type PayrollStatus = "GENERATED" | "APPROVED";

/** Row shape returned by `GET /api/hr/payroll`. */
export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  /** `YYYY-MM`. */
  month: string;
  gross: number;
  deductions: number;
  net: number;
  status: PayrollStatus;
}

/** Shape returned by `GET /api/hr/payslip` (a single employee's payroll row). */
export type Payslip = PayrollRecord;

// ---- Request bodies ----------------------------------------------------------

/** Body for `POST /api/hr/employees`. `schoolId` required only for Central officers. */
export interface CreateEmployeeInput {
  schoolId?: string;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  userId?: string;
}

/** Body for `POST /api/hr/leave`. Employee is derived from the JWT userId. */
export interface ApplyLeaveInput {
  schoolId?: string;
  /** `YYYY-MM-DD`. */
  fromDate: string;
  /** `YYYY-MM-DD`. */
  toDate: string;
  type: string;
}

/** Body for `POST /api/hr/payroll/generate`. `schoolId` required only for Central officers. */
export interface GeneratePayrollInput {
  schoolId?: string;
  /** `YYYY-MM`. */
  month: string;
}

/** Body for `PATCH /api/hr/leave/[id]`. */
export interface UpdateLeaveStatusInput {
  status: Exclude<LeaveStatus, "PENDING">;
}

// ---- Form option constants ---------------------------------------------------

/** Leave types offered in the Apply Leave form. */
export const LEAVE_TYPES = [
  "CASUAL",
  "SICK",
  "EARNED",
  "MATERNITY",
  "PATERNITY",
  "UNPAID",
] as const;

/** Payroll statuses shown in the payroll table. */
export const PAYROLL_STATUS_OPTIONS: PayrollStatus[] = ["GENERATED", "APPROVED"];

// ---- Role helpers (spec §2) --------------------------------------------------

/** Roles granted module access: Registrar/Admin, Finance Officer, Faculty. */
const HR_PERMITTED_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "FINANCE_OFFICER",
  "FACULTY",
];

/** Roles that manage employees (add/edit). */
const EMPLOYEE_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Roles that approve/reject leave. */
const LEAVE_APPROVER_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Roles that generate payroll. */
const PAYROLL_GENERATOR_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Roles that finalize (approve) payroll. */
const PAYROLL_APPROVER_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE_OFFICER"];

/** Can the role open the HR & Payroll module at all? */
export function canAccessHr(role?: UserRole): boolean {
  return !!role && HR_PERMITTED_ROLES.includes(role);
}

/** Can the role manage employees? (Registrar/Admin) */
export function canManageEmployees(role?: UserRole): boolean {
  return !!role && EMPLOYEE_MANAGER_ROLES.includes(role);
}

/** Is the role a faculty member (own-record scope)? */
export function isFaculty(role?: UserRole): boolean {
  return role === "FACULTY";
}

/** Can the role approve/reject leave? (Registrar/Admin) */
export function canApproveLeave(role?: UserRole): boolean {
  return !!role && LEAVE_APPROVER_ROLES.includes(role);
}

/** Can the role generate payroll? (Registrar/Admin) */
export function canGeneratePayroll(role?: UserRole): boolean {
  return !!role && PAYROLL_GENERATOR_ROLES.includes(role);
}

/** Can the role finalize (approve) payroll? (Finance Officer) */
export function canApprovePayroll(role?: UserRole): boolean {
  return !!role && PAYROLL_APPROVER_ROLES.includes(role);
}

// ---- Display helpers ----------------------------------------------------------

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format a currency amount as INR without decimals. */
export function formatAmount(value: number): string {
  return INR.format(value || 0);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a `YYYY-MM` value as a friendly label (e.g. `Nov 2026`). */
export function formatMonthLabel(month: string): string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || "—";
  const [year, mon] = month.split("-");
  const d = new Date(Number(year), Number(mon) - 1, 1);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** `YYYY-MM` for the month that contains the given Date. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

// ---- Error contract ----------------------------------------------------------

export interface HrApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class HrApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "HrApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<HrApiError> {
  let message = `Request failed with status ${res.status}`;
  let code: string | undefined;
  let details: unknown;
  try {
    const body = (await res.json()) as HrApiErrorBody;
    if (body?.error?.message) message = body.error.message;
    code = body?.error?.code;
    details = body?.error?.details;
  } catch {
    /* no json body */
  }
  return new HrApiError(res.status, message, code, details);
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

// ---- Endpoint wrappers (one per frozen contract endpoint) -----------------------

/** `GET /api/hr/employees?schoolId=` → employees (faculty sees own only). */
export function fetchEmployees(filters: { schoolId?: string } = {}): Promise<Employee[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  const qs = p.toString();
  return request(`/api/hr/employees${qs ? `?${qs}` : ""}`);
}

/** `POST /api/hr/employees` (Registrar/Admin) → `201 { id }`. */
export function createEmployee(input: CreateEmployeeInput): Promise<{ id: string }> {
  return request("/api/hr/employees", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `GET /api/hr/employees/me` (Faculty) → own employee record. Throws 404 if unregistered. */
export function fetchMyEmployee(): Promise<Employee> {
  return request("/api/hr/employees/me");
}

/** `POST /api/hr/leave` (Faculty) → `201 { requestId }`. */
export function applyLeave(input: ApplyLeaveInput): Promise<{ requestId: string }> {
  return request("/api/hr/leave", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `GET /api/hr/leave?schoolId=` → leave requests (faculty sees own only). */
export function fetchLeaveRequests(filters: { schoolId?: string } = {}): Promise<LeaveRequest[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  const qs = p.toString();
  return request(`/api/hr/leave${qs ? `?${qs}` : ""}`);
}

/** `PATCH /api/hr/leave/[id]` (Registrar/Admin) → `200 { id, status }`. */
export function updateLeaveStatus(
  id: string,
  input: UpdateLeaveStatusInput
): Promise<{ id: string; status: LeaveStatus }> {
  return request(`/api/hr/leave/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** `POST /api/hr/payroll/generate` (Registrar/Admin) → `201 { payrollId }`. */
export function generatePayroll(input: GeneratePayrollInput): Promise<{ payrollId: string }> {
  return request("/api/hr/payroll/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `GET /api/hr/payroll?schoolId=&month=` → payroll records. */
export function fetchPayrolls(
  filters: { schoolId?: string; month?: string } = {}
): Promise<PayrollRecord[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  if (filters.month) p.set("month", filters.month);
  const qs = p.toString();
  return request(`/api/hr/payroll${qs ? `?${qs}` : ""}`);
}

/** `POST /api/hr/payroll/[id]/approve` (Finance Officer) → `200 { id, status }`. */
export function approvePayroll(id: string): Promise<{ id: string; status: PayrollStatus }> {
  return request(`/api/hr/payroll/${encodeURIComponent(id)}/approve`, {
    method: "POST",
  });
}

/** `GET /api/hr/payslip?month=` (Faculty) → own payslip. Throws 404 if none. */
export function fetchMyPayslip(filters: { month?: string } = {}): Promise<Payslip> {
  const p = new URLSearchParams();
  if (filters.month) p.set("month", filters.month);
  const qs = p.toString();
  return request(`/api/hr/payslip${qs ? `?${qs}` : ""}`);
}
