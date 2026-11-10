import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { createMappingSchema } from '@/lib/obe-schemas';
import {
  resolveCreateTenant,
  assertCourseBelongsToSchool,
  assertCOBelongsToCourse,
  loadCourseTenant,
  loadPO,
} from '@/lib/obe-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';


// ---------------------------------------------------------------------------
// GET /api/obe/mappings?courseId= — get CO–PO matrix (read roles)
//   200 [{ coId, coCode, poId, poCode, weight }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const courseId = url.searchParams.get('courseId');

  if (!guardRole(user.role, 'FACULTY', 'DEAN', 'REGISTRAR_ADMIN')) {
    throw new ApiError(403, 'FORBIDDEN', 'Faculty, dean or registrar access required');
  }

  return withClient(user, async (db) => {
    if (!courseId) {
      return successResponse([]);
    }

    const { tenant } = await loadCourseTenant(db, user, courseId);

    const mappings = await db.cOPOMapping.findMany({
      where: { schoolId: tenant, courseId },
      select: { coId: true, poId: true, weight: true },
      orderBy: { coId: 'asc' },
    });

    if (mappings.length === 0) {
      return successResponse([]);
    }

    const coIds = Array.from(new Set(mappings.map((m) => m.coId)));
    const poIds = Array.from(new Set(mappings.map((m) => m.poId)));

    const [cos, pos] = await Promise.all([
      db.courseOutcome.findMany({
        where: { schoolId: tenant, id: { in: coIds } },
        select: { id: true, code: true },
      }),
      db.programOutcome.findMany({
        where: { schoolId: tenant, id: { in: poIds } },
        select: { id: true, code: true },
      }),
    ]);

    const coCode = new Map(cos.map((c) => [c.id, c.code]));
    const poCode = new Map(pos.map((p) => [p.id, p.code]));

    const result = mappings.map((m) => ({
      coId: m.coId,
      coCode: coCode.get(m.coId) ?? null,
      poId: m.poId,
      poCode: poCode.get(m.poId) ?? null,
      weight: m.weight,
    }));

    return successResponse(result);
  });
});

// ---------------------------------------------------------------------------
// POST /api/obe/mappings — set CO–PO weights for a course (FACULTY)
//   201 { courseId }
//   400 weight not in [0,1] | 404 course/CO/PO missing
//   400 CO/PO not in same program/school
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'FACULTY')) {
      throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
    }

    const body = await validateBody(request, createMappingSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    return await withClient(user, async (db) => {
      const course = await assertCourseBelongsToSchool(db, body.courseId, tenant);

      // Validate every CO/PO before mutating anything (all-or-nothing).
      for (const m of body.mappings) {
        const co = await assertCOBelongsToCourse(db, m.coId, body.courseId, tenant);
        const po = await loadPO(db, m.poId);
        if (po.schoolId !== tenant) {
          throw new ApiError(400, 'SCHOOL_MISMATCH', 'PO does not belong to this school');
        }
        if (po.programId !== course.programId) {
          throw new ApiError(400, 'PROGRAM_MISMATCH', 'PO does not belong to the course program');
        }
        if (m.weight < 0 || m.weight > 1) {
          throw new ApiError(400, 'WEIGHT_OUT_OF_RANGE', 'Mapping weight must be in [0, 1]');
        }
        void co;
      }

      // Replace the full matrix for this course.
      await db.cOPOMapping.deleteMany({
        where: { schoolId: tenant, courseId: body.courseId },
      });

      await db.cOPOMapping.createMany({
        data: body.mappings.map((m) => ({
          schoolId: tenant,
          courseId: body.courseId,
          coId: m.coId,
          poId: m.poId,
          weight: m.weight,
        })),
      });

      return successResponse({ courseId: body.courseId }, 201);
    });
  } catch (error) {
    throw error;
  }
});
