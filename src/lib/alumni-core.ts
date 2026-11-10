// ==============================================================================
// Alumni Management module (Module 10 — final) backend business logic.
// Pure functions (donation aggregation) live here so the tester can unit-test
// them without a database. Thin DB helpers (tenant resolution, ownership
// asserts, self-student lookup) are re-exported from the Hostel/Fees modules so
// the API routes stay consistent with the rest of the ERP's multi-tenant model.
//
// Multi-tenant model:
//   - school-scoped users use the extended client (auto-injects schoolId);
//   - central 'ALL' controllers (REGISTRAR_ADMIN) use the base client and
//     resolve a tenant from body.schoolId on creates or ?schoolId= on reads.
// ==============================================================================

import { ApiError } from './errors';

// Re-export shared tenant/ownership helpers (keeps one source of truth).
export {
  resolveCreateTenant,
  assertStudentBelongsToSchool,
  findSelfStudent,
  tenantFilter,
} from './hostel-core';

// ---- Pure helpers (unit-tested) ----------------------------------------------

/** Accepted donation modes (spec §6: invalid mode -> 400). */
export const DONATION_MODES = [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'ONLINE',
] as const;

export type DonationMode = (typeof DONATION_MODES)[number];

export function isDonationMode(mode: string): mode is DonationMode {
  return (DONATION_MODES as readonly string[]).includes(mode);
}

const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface DonationRow {
  amount: number;
}

/**
 * Pure aggregation over donation rows (spec §6.4):
 *   - count = number of rows;
 *   - sum   = sum of amounts rounded to 2 decimal places (cent precision,
 *     float-safe, identical to the money math used across the ERP).
 */
export function computeDonationTotals(rows: ReadonlyArray<DonationRow>): {
  count: number;
  sum: number;
} {
  const count = rows.length;
  const sum = roundMoney(
    rows.reduce((total, r) => total + (Number(r.amount) || 0), 0)
  );
  return { count, sum };
}

/**
 * Validates a donation amount: must be a finite number strictly greater than 0.
 * Returns the normalized number or throws ApiError 400.
 */
export function assertValidDonationAmount(amount: unknown): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Donation amount must be greater than 0');
  }
  return roundMoney(n);
}
