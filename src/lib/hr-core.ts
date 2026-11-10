// ==============================================================================
// HR & Payroll module (Module 9) — backend business logic.
// Pure functions (gross-from-designation, deductions, net pay, leave-type
// validation) live here so the tester can unit-test them without a database.
// Thin DB helpers (tenant resolution) are re-exported from fee-core and used
// by the API routes.
// ==============================================================================

import { ApiError } from './errors';

export { resolveCreateTenant } from './fee-core';

// ---- Pure helpers (unit-tested) ----------------------------------------------

const roundMoney2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Staff salary structure (gross per designation) per spec §6.3.
 * Any designation not in the table falls back to the default gross.
 */
const DESIGNATION_GROSS: Record<string, number> = {
  Professor: 120000,
  AssocProf: 100000,
  AsstProf: 80000,
};

const DEFAULT_GROSS = 60000;

export function designationGross(designation: string): number {
  return DESIGNATION_GROSS[designation] ?? DEFAULT_GROSS;
}

/**
 * Deductions = flat 10% of gross (tax), rounded to 2 decimal places.
 */
export function deductionsFor(gross: number): number {
  const g = Number(gross);
  if (!Number.isFinite(g) || g < 0) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Gross must be a non-negative number');
  }
  return roundMoney2(g * 0.1);
}

/**
 * Net pay = gross - deductions (pure, exact to cent). The result must never be
 * negative; if the inputs would produce a negative net, this throws (400).
 */
export function computeNet(gross: number, deductions: number): number {
  const g = Number(gross);
  const d = Number(deductions);
  if (!Number.isFinite(g) || !Number.isFinite(d)) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'gross and deductions must be numbers');
  }
  const net = roundMoney2(g - d);
  if (net < 0) {
    throw new ApiError(400, 'INVALID_CALCULATION', 'Net pay cannot be negative');
  }
  return net;
}

// ---- Leave types ---------------------------------------------------------------

export const VALID_LEAVE_TYPES = ['SICK', 'CASUAL', 'EARNED'] as const;

export function isValidLeaveType(type: string): boolean {
  return (VALID_LEAVE_TYPES as readonly string[]).includes(type);
}
