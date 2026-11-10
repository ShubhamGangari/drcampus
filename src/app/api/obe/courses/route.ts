import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { createCourseOutcomesSchema } from '@/lib/obe-schemas';
import {
  resolveCreateTenant,
  assertCourseBelongsToSchool,
  loadProgramTenant,
  isCentralUserObe,
} from '@/lib/obe-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';


// ---------------------------------------------------------------------------
// GET /api/obe/courses — list courses (+COs), optional programId filter
// (FACULTY, DEAN, REGISTRAR_ADMIN).
//   200 [{ id, courseId, courseCode, courseTitle, programId, cos }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const programId = url.searchParams.get('programId') ?? undefined;

  if (!guardRole(user.role, 'FACULTY', 'DEAN', 'REGISTRAR_ADMIN')) {
    throw new ApiError(403, 'FORBIDDEN', 'Faculty, dean or registrar access required');
  }

  return withClient(user, async (db) => {
    let tenant: string;
    let where: Record<string, unknown> = {};

    if (isCentralUserObe(user)) {
      // Central users have no implicit school; anchor via the program when given.
      if (!programId) {
        return successResponse([]);
      }
      ({ tenant } = await loadProgramTenant(db, user, programId));
      where = { schoolId: tenant, programId };
    } else {
      tenant = user.schoolId;
      where = programId ? { programId } : {};
    }

    const courses = await db.course.findMany({
      where,
      select: { id: true, programId: true, code: true, title: true },
      orderBy: { code: 'asc' },
    });

    if (courses.length === 0) {
      return successResponse([]);
    }

    const courseIds = courses.map((c) => c.id);
    const cos = await db.courseOutcome.findMany({
      where: { schoolId: tenant, courseId: { in: courseIds } },
      select: { id: true, courseId: true, code: true, description: true },
      orderBy: { code: 'asc' },
    });

    const cosByCourse = new Map<string, { id: string; code: string; description: string }[]>();
    for (const co of cos) {
      const list = cosByCourse.get(co.courseId) ?? [];
      list.push({ id: co.id, code: co.code, description: co.description });
      cosByCourse.set(co.courseId, list);
    }

    const result = courses.map((c) => ({
      id: c.id,
      courseId: c.id,
      courseCode: c.code,
      courseTitle: c.title,
      programId: c.programId,
      cos: cosByCourse.get(c.id) ?? [],
    }));

    return successResponse(result);
  });
});

// ---------------------------------------------------------------------------
// POST /api/obe/courses — attach a course-outcome set to an existing Course
// (FACULTY). 201 { courseId }
//   404 course missing | 400 course-tenant mismatch / no COs / duplicate CO code
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'FACULTY')) {
      throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
    }

    const body = await validateBody(request, createCourseOutcomesSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    return await withClient(user, async (db) => {
      await assertCourseBelongsToSchool(db, body.courseId, tenant);

      // Duplicate codes within the submitted array.
      const seen = new Set<string>();
      for (const co of body.cos) {
        if (seen.has(co.code)) {
          throw new ApiError(400, 'DUPLICATE_CO_CODE', 'Duplicate CO code in request');
        }
        seen.add(co.code);
      }

      // Duplicate codes already attached to the course.
      const existing = await db.courseOutcome.findMany({
        where: { schoolId: tenant, courseId: body.courseId, code: { in: Array.from(seen) } },
        select: { code: true },
      });
      if (existing.length > 0) {
        throw new ApiError(
          400,
          'DUPLICATE_CO_CODE',
          `CO code already exists: ${existing.map((e) => e.code).join(', ')}`
        );
      }

      await db.courseOutcome.createMany({
        data: body.cos.map((co: { code: string; description: string }) => ({
          schoolId: tenant,
          courseId: body.courseId,
          code: co.code,
          description: co.description,
        })),
      });

      return successResponse({ courseId: body.courseId }, 201);
    });
  } catch (error) {
    throw error;
  }
});
