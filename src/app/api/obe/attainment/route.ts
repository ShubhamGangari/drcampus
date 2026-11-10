import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { createAttainmentSchema } from '@/lib/obe-schemas';
import {
  resolveCreateTenant,
  assertCourseBelongsToSchool,
  assertCOBelongsToCourse,
  loadCourseTenant,
  isCentralUserObe,
} from '@/lib/obe-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';


// ---------------------------------------------------------------------------
// GET /api/obe/attainment?courseId=&academicYear= — list attainment (read roles)
//   200 [{ id, courseId, coId, coCode, attainment, academicYear }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const courseId = url.searchParams.get('courseId') ?? undefined;
  const academicYear = url.searchParams.get('academicYear') ?? undefined;

  if (!guardRole(user.role, 'FACULTY', 'DEAN', 'REGISTRAR_ADMIN')) {
    throw new ApiError(403, 'FORBIDDEN', 'Faculty, dean or registrar access required');
  }

  return withClient(user, async (db) => {
    let tenant: string;
    let where: Record<string, unknown> = {};

    if (isCentralUserObe(user)) {
      if (!courseId) {
        return successResponse([]);
      }
      ({ tenant } = await loadCourseTenant(db, user, courseId));
      where = { schoolId: tenant, courseId };
    } else {
      tenant = user.schoolId;
      where = courseId ? { courseId } : {};
    }

    if (academicYear) {
      where.academicYear = academicYear;
    }

    const rows = await db.cOAttainment.findMany({
      where,
      select: { id: true, courseId: true, coId: true, attainment: true, academicYear: true },
      orderBy: [{ academicYear: 'asc' }, { coId: 'asc' }],
    });

    if (rows.length === 0) {
      return successResponse([]);
    }

    const coIds = Array.from(new Set(rows.map((r) => r.coId)));
    const cos = await db.courseOutcome.findMany({
      where: { schoolId: tenant, id: { in: coIds } },
      select: { id: true, code: true },
    });
    const coCode = new Map(cos.map((c) => [c.id, c.code]));

    const result = rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      coId: r.coId,
      coCode: coCode.get(r.coId) ?? null,
      attainment: r.attainment,
      academicYear: r.academicYear,
    }));

    return successResponse(result);
  });
});

// ---------------------------------------------------------------------------
// POST /api/obe/attainment — enter CO attainment (FACULTY)
//   201 { attainmentId } | 400 not in [0,100] | 404 course/CO missing | 409 dup
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'FACULTY')) {
      throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
    }

    const body = await validateBody(request, createAttainmentSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    return await withClient(user, async (db) => {
      if (body.attainment < 0 || body.attainment > 100) {
        throw new ApiError(400, 'ATTAINMENT_OUT_OF_RANGE', 'Attainment must be in [0, 100]');
      }

      await assertCourseBelongsToSchool(db, body.courseId, tenant);
      await assertCOBelongsToCourse(db, body.coId, body.courseId, tenant);

      const existing = await db.cOAttainment.findFirst({
        where: {
          schoolId: tenant,
          courseId: body.courseId,
          coId: body.coId,
          academicYear: body.academicYear,
        },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError(
          409,
          'DUPLICATE_ATTAINMENT',
          'Attainment already exists for this course/CO/academic year'
        );
      }

      const rec = await db.cOAttainment.create({
        data: {
          schoolId: tenant,
          courseId: body.courseId,
          coId: body.coId,
          academicYear: body.academicYear,
          attainment: body.attainment,
        },
        select: { id: true },
      });

      return successResponse({ attainmentId: rec.id }, 201);
    });
  } catch (error) {
    throw error;
  }
});
