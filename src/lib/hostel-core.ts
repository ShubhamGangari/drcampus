// ==============================================================================
// Hostel Management module (Module 8) — backend business logic.
// Pure functions (occupied count, capacity state, money rounding) live here so
// the tester can unit-test them without a database. Thin tenant helpers are
// re-exported from the Fees module so the API routes stay consistent with the
// rest of the ERP's multi-tenant model.
// ==============================================================================

// Re-export shared tenant/ownership helpers (keeps one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Pure helpers (unit-tested) ----------------------------------------------

export interface AllocationLike {
  vacatedAt: Date | null;
}

/**
 * Count of ACTIVE allocations in a list (i.e. those not yet vacated).
 * Allocations where `vacatedAt` is null are considered active.
 */
export function occupiedCount(allocations: ReadonlyArray<AllocationLike>): number {
  return allocations.filter((a) => a.vacatedAt === null).length;
}

export interface CapacityState {
  occupied: number;
  capacity: number;
  available: number;
  isFull: boolean;
}

/**
 * Derives a room's capacity state from its occupied count and total capacity.
 * Both inputs are coerced to non-negative integers; when `occupied >= capacity`
 * the room is full.
 */
export function computeCapacityState(occupied: number, capacity: number): CapacityState {
  const o = Math.max(0, Math.floor(Number(occupied) || 0));
  const c = Math.max(0, Math.floor(Number(capacity) || 0));
  const available = Math.max(0, c - o);
  return { occupied: o, capacity: c, available, isFull: available <= 0 };
}

/**
 * Rounds a money value to 2 decimal places (cent precision, float-safe).
 * Used for mess bills so stored amounts are exact to the cent.
 */
export function roundMoney2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Builds a tenant filter for queries run by central ('ALL') officers.
 * School-scoped users never pass this — the extended Prisma client injects
 * their schoolId automatically. Central officers must include the target
 * schoolId explicitly or the query would span every school.
 */
export function tenantFilter(
  isCentral: boolean,
  schoolId: string | undefined
): Record<string, unknown> {
  if (!isCentral || !schoolId) return {};
  return { schoolId };
}
