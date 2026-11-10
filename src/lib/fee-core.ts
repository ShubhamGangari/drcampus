// ==============================================================================
// Fees Management module (Module 3) — backend business logic.
// Pure functions (late fee, invoice paid/status, document number builders,
// sequence math) live here so the tester can unit-test them without a database.
// Thin DB helpers (tenant resolution, ownership asserts, self-student lookup,
// next-sequence) are used by the API routes.
//
// NOTE: `src/lib/fees.ts` is owned by the frontend API client (typed fetchers).
// Backend logic intentionally lives here in `fee-core.ts` to keep the modules
// decoupled and avoid clobbering the client module.
// ==============================================================================

import type { AuthPayload } from './auth';
import { isCentralUser, type Db } from './prisma';
import { ApiError } from './errors';

type DynamicFindManyDelegate = {
  findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
};

// Invoice lifecycle states. "Active" states are those still open to payment;
// terminal states may never be re-invoiced (duplicate active invoice rule).
export const INVOICE_ACTIVE_STATUSES = ['UNPAID', 'PARTIAL'] as const;
export const INVOICE_TERMINAL_STATUSES = ['PAID', 'CANCELED', 'VOID'] as const;

export function isActiveInvoiceStatus(status: string): boolean {
  return (INVOICE_ACTIVE_STATUSES as readonly string[]).includes(status);
}

const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * Exact sum of fee components rounded to 2 decimal places (float-safe to cent).
 * Used to recompute `totalAmount` whenever `components` change on a structure.
 */
export function computeComponentsTotal(components: Array<{ amount: number }>): number {
  return roundMoney(components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0));
}

/**
 * Late fee: 2% per month of overdue, capped at 10% of the overdue amount.
 * Returns the fee rounded to 2 decimal places. Non-positive months -> 0.
 */
export function computeLateFee(overdueAmount: number, monthsOverdue: number): number {
  const months = Math.max(0, Math.floor(Number(monthsOverdue) || 0));
  if (months === 0) return 0;
  const pct = Math.min(0.02 * months, 0.1);
  return roundMoney(Number(overdueAmount) * pct);
}

/**
 * Given an invoice amount and its payments, returns the running paid amount and
 * the derived status: UNPAID (nothing paid), PARTIAL (some but not all), PAID
 * (paid >= invoice amount). Amounts are compared at cent precision.
 */
export function computeInvoicePaid(
  invoiceAmount: number,
  payments: Array<{ amount: number }>
): { paidAmount: number; status: 'UNPAID' | 'PARTIAL' | 'PAID' } {
  const paidAmount = roundMoney(
    payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
  const target = roundMoney(Number(invoiceAmount));
  const status =
    paidAmount >= target - 1e-9 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
  return { paidAmount, status };
}

/**
 * True when `dueDate` is strictly before the start of "today" (local time).
 * A due date equal to today is NOT considered past. Exposed as a pure function
 * so the tester can unit-test the due-date-in-past business rule without a DB.
 */
export function isDueDateInPast(dueDate: Date, now: Date = new Date()): boolean {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDate.getTime() < todayStart.getTime();
}

/** Invoice number builder: `INV-{year}-{6-digit seq}`. */
export function buildInvoiceNo(seq: number, year: string | number): string {
  const n = String(Math.max(1, Math.floor(Number(seq) || 1))).padStart(6, '0');
  return `INV-${year}-${n}`;
}

/** Receipt number builder: `RCPT-{year}-{6-digit seq}`. */
export function buildReceiptNo(seq: number, year: string | number): string {
  const n = String(Math.max(1, Math.floor(Number(seq) || 1))).padStart(6, '0');
  return `RCPT-${year}-${n}`;
}

/**
 * Pure sequence math: from a list of existing document numbers sharing a prefix,
 * returns max numeric suffix + 1 (1 when nothing matches). Never relies on a raw
 * COUNT, so gaps and concurrent inserts cannot collide silently.
 */
export function computeNextSeq(existingNumbers: Array<unknown>, prefix: string): number {
  let max = 0;
  for (const raw of existingNumbers) {
    if (typeof raw !== 'string' || !raw.startsWith(prefix)) continue;
    const parsed = parseInt(raw.slice(prefix.length), 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }
  return max + 1;
}

// ---- Tenant resolution & ownership (thin DB helpers) --------------------------

/**
 * Resolves the concrete schoolId a create-style write must use.
 * - School-scoped users always write to their own school; any body schoolId is
 *   ignored so a non-central user can never write into another tenant.
 * - Central officers (schoolId === 'ALL') must specify a target schoolId in the
 *   request body; when absent, SCHOOL_ID_REQUIRED (400) is thrown.
 */
export function resolveCreateTenant(user: { schoolId: string }, bodySchoolId?: string): string {
  if (!isCentralUser(user)) {
    return user.schoolId;
  }
  if (!bodySchoolId) {
    throw new ApiError(400, 'SCHOOL_ID_REQUIRED', 'Central officers must specify a schoolId');
  }
  return bodySchoolId;
}

/** Loads a student and asserts it belongs to `schoolId` (404 / 400). */
export async function assertStudentBelongsToSchool(
  db: Db,
  studentId: string,
  schoolId: string
) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, schoolId: true, firstName: true, lastName: true, rollNo: true },
  });
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Student not found');
  }
  if (student.schoolId !== schoolId) {
    throw new ApiError(400, 'SCHOOL_MISMATCH', 'Student does not belong to this school');
  }
  return student;
}

/** Loads a program and asserts it belongs to `schoolId` (404 / 400). */
export async function assertProgramBelongsToSchool(
  db: Db,
  programId: string,
  schoolId: string
) {
  const program = await db.program.findUnique({
    where: { id: programId },
    select: { id: true, schoolId: true },
  });
  if (!program) {
    throw new ApiError(404, 'NOT_FOUND', 'Program not found');
  }
  if (program.schoolId !== schoolId) {
    throw new ApiError(400, 'SCHOOL_MISMATCH', 'Program does not belong to this school');
  }
  return program;
}

/**
 * Resolves the logged-in user's own Student record, if one exists. The only
 * stable link between a User account and a Student row is the email address.
 */
export async function findSelfStudent(db: Db, user: AuthPayload) {
  const u = await db.user.findUnique({
    where: { id: user.userId },
    select: { email: true },
  });
  if (!u?.email) return null;
  return db.student.findFirst({ where: { email: u.email } });
}

// ---- Next document number (thin DB helper) ------------------------------------

/**
 * Computes the next sequence for a document-number field of a model within a
 * school and year prefix (e.g. `INV-2026-`). Queries carry an explicit schoolId
 * so the base (central) client is correctly scoped; the extended per-school
 * client merges the same value harmlessly.
 */
export async function getNextSequence(
  db: Db,
  model: string,
  field: string,
  prefix: string,
  schoolId: string
): Promise<number> {
  const rows = await (db as unknown as Record<string, DynamicFindManyDelegate>)[model].findMany({
    where: { schoolId, [field]: { startsWith: prefix } },
    select: { [field]: true },
  });
  return computeNextSeq(rows.map((r) => r[field]), prefix);
}
