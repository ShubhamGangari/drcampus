import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { updateCOSchema } from '@/lib/obe-schemas';
import { loadCourseTenant, assertCOBelongsToCourse } from '@/lib/obe-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';


// ---------------------------------------------------------------------------
// PUT /api/obe/courses/[courseId]/cos/[coId] — edit a CO (FACULTY)
//   200 { coId, code, description } | 404 course/CO missing
// ---------------------------------------------------------------------------
export const PUT = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, 'FACULTY')) {
      throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
    }

    const body = await validateBody(request, updateCOSchema);
    const courseId = params.courseId as string;
    const coId = params.coId as string;

    return await withClient(user, async (db) => {
      const { tenant } = await loadCourseTenant(db, user, courseId);
      const co = await assertCOBelongsToCourse(db, coId, courseId, tenant);

      if (body.code !== undefined && body.code !== co.code) {
        const dup = await db.courseOutcome.findFirst({
          where: { schoolId: tenant, courseId, code: body.code },
          select: { id: true },
        });
        if (dup) {
          throw new ApiError(400, 'DUPLICATE_CO_CODE', 'A CO with this code already exists on the course');
        }
      }

      const data: Record<string, unknown> = {};
      if (body.code !== undefined) data.code = body.code;
      if (body.description !== undefined) data.description = body.description;

      const updated = await db.courseOutcome.update({
        where: { id: coId, schoolId: tenant },
        data,
        select: { id: true, code: true, description: true },
      });

      return successResponse({
        coId: updated.id,
        code: updated.code,
        description: updated.description,
      });
    });
  } catch (error) {
    throw error;
  }
});
