// ==============================================================================
// OBE module (Module 5) — backend business logic.
// Pure functions (CO–PO attainment math) live here so the tester can unit-test
// them without a database. Thin DB helpers (tenant resolution, PO/CO ownership
// asserts) are used by the API routes.
//
// Multi-tenant model:
//   - school-scoped users use the extended client (auto-injects schoolId);
//   - central 'ALL' controllers use the base client and resolve a tenant from
//     the target program/course resource or from body.schoolId on creates.
// ==============================================================================

import { ApiError } from './errors';
import { isCentralUser, type Db } from './prisma';
import { resolveCreateTenant, assertProgramBelongsToSchool } from './fee-core';
import { assertCourseBelongsToSchool } from './exam-core';

// ---- Pure helpers (unit-tested) ----------------------------------------------

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface POMappingWeight {
  coId: string;
  weight: number;
}

export interface COAttainmentValue {
  coId: string;
  attainment: number;
}

/**
 * PO attainment for a single program outcome = weighted average over the COs
 * that map to that PO (spec §6.3):
 *
 *   PO_attainment = Σ(weight_co_po × attainment_co) / Σ(weight_co_po)
 *
 * summed over all COs that both map to the PO AND have an attainment value in
 * the requested year. Rounded to 2 decimal places. Mappings without a matching
 * attainment are ignored (they contribute nothing to this call). When there are
 * no contributing COs the result is 0.
 *
 * AC#5: weights 1.0 (attainment 80) and 0.5 (attainment 60)
 *   -> (80×1 + 60×0.5) / (1 + 0.5) = 110 / 1.5 = 73.33
 */
export function computePOAttainment(
  mappingWeights: Array<POMappingWeight>,
  attainments: Array<COAttainmentValue>
): number {
  const attainmentByCoId = new Map<string, number>();
  for (const a of attainments) {
    attainmentByCoId.set(a.coId, Number(a.attainment) || 0);
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const m of mappingWeights) {
    const attainment = attainmentByCoId.get(m.coId);
    if (attainment === undefined) continue; // CO has no attainment in this year
    const weight = Number(m.weight) || 0;
    weightedSum += weight * attainment;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return 0;
  return round2(weightedSum / totalWeight);
}

// ---- Tenant resolution & ownership (thin DB helpers) --------------------------

export { resolveCreateTenant, assertProgramBelongsToSchool, assertCourseBelongsToSchool };

/**
 * Loads a program outcome by id and returns it (404 when missing).
 * Works for both clients: the per-school client is auto-scoped; the central base
 * client returns the row so the caller can assert school ownership.
 */
export async function loadPO(db: Db, poId: string) {
  const po = await db.programOutcome.findUnique({
    where: { id: poId },
    select: {
      id: true,
      schoolId: true,
      programId: true,
      code: true,
      description: true,
    },
  });
  if (!po) {
    throw new ApiError(404, 'NOT_FOUND', 'Program outcome not found');
  }
  return po;
}

/**
 * Loads a course outcome by id and returns it (404 when missing).
 * Works for both clients (see loadPO).
 */
export async function loadCO(db: Db, coId: string) {
  const co = await db.courseOutcome.findUnique({
    where: { id: coId },
    select: {
      id: true,
      schoolId: true,
      courseId: true,
      code: true,
      description: true,
    },
  });
  if (!co) {
    throw new ApiError(404, 'NOT_FOUND', 'Course outcome not found');
  }
  return co;
}

/**
 * Loads a course outcome and asserts it belongs to `courseId` and `schoolId`
 * (404 / 400). Used when a CO must be tied to the course being written.
 */
export async function assertCOBelongsToCourse(
  db: Db,
  coId: string,
  courseId: string,
  schoolId: string
) {
  const co = await loadCO(db, coId);
  if (co.courseId !== courseId) {
    throw new ApiError(400, 'COURSE_MISMATCH', 'Course outcome does not belong to this course');
  }
  if (co.schoolId !== schoolId) {
    throw new ApiError(400, 'SCHOOL_MISMATCH', 'Course outcome does not belong to this school');
  }
  return co;
}

/**
 * Returns true when the caller is a central ('ALL') user. Convenience re-export
 * so routes can branch on tenant for read scoping without importing prisma.
 */
export function isCentralUserObe(user: { schoolId: string }): boolean {
  return isCentralUser(user);
}

/**
 * Resolves the concrete tenant for a `programId`-scoped operation.
 * - school-scoped users: tenant is their own school; the program must belong to
 *   it (404 / 400).
 * - central ('ALL') users: tenant is derived from the program resource itself
 *   (the program is globally unique).
 * Returns `{ tenant, program }`.
 */
export async function loadProgramTenant(
  db: Db,
  user: { schoolId: string },
  programId: string
) {
  if (isCentralUserObe(user)) {
    const program = await db.program.findUnique({
      where: { id: programId },
      select: { id: true, schoolId: true, code: true, name: true },
    });
    if (!program) {
      throw new ApiError(404, 'NOT_FOUND', 'Program not found');
    }
    return { tenant: program.schoolId, program };
  }
  const program = await assertProgramBelongsToSchool(db, programId, user.schoolId);
  return { tenant: program.schoolId, program };
}

/**
 * Resolves the concrete tenant for a `courseId`-scoped operation (analogous to
 * `loadProgramTenant`). Returns `{ tenant, course }`.
 */
export async function loadCourseTenant(
  db: Db,
  user: { schoolId: string },
  courseId: string
) {
  if (isCentralUserObe(user)) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true, schoolId: true, programId: true, code: true, title: true },
    });
    if (!course) {
      throw new ApiError(404, 'NOT_FOUND', 'Course not found');
    }
    return { tenant: course.schoolId, course };
  }
  const course = await assertCourseBelongsToSchool(db, courseId, user.schoolId);
  return { tenant: course.schoolId, course };
}
