import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createClassGroupSchema } from '@/lib/validators';
import { requirePermission, getActingUser } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.view');

    const { searchParams } = new URL(request.url);
    const where: Record<string, unknown> = {};
    if (isCentralUser(user)) {
      // Central users (schoolId 'ALL') may view all schools, optionally filtered.
      const schoolId = searchParams.get('schoolId');
      if (schoolId) where.schoolId = schoolId;
    } else {
      // Non-central users are always scoped to their own school.
      where.schoolId = me.schoolId;
    }
    if (searchParams.get('programId')) where.programId = searchParams.get('programId');
    if (searchParams.get('batchId')) where.batchId = searchParams.get('batchId');

    const classes = await withClient(user, (db) =>
      db.classGroup.findMany({
        where,
        orderBy: { section: 'asc' },
        include: {
          program: { select: { id: true, name: true, code: true } },
          batch: { select: { id: true, name: true } },
          coordinator: { select: { id: true, name: true } },
        },
      })
    );

    const items = classes.map((c) => ({
      id: c.id,
      schoolId: c.schoolId,
      programId: c.programId,
      batchId: c.batchId,
      section: c.section,
      coordinatorUserId: c.coordinatorUserId,
      program: c.program,
      batch: c.batch,
      coordinator: c.coordinator ?? null,
    }));

    return successResponse({ items });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.manage_classes');

    const data = await validateBody(request, createClassGroupSchema);

    let targetSchoolId = user.schoolId;
    if (isCentralUser(user)) {
      if (!data.schoolId) {
        throw new ApiError(400, 'SCHOOL_REQUIRED', 'Central officers must specify a schoolId');
      }
      targetSchoolId = data.schoolId;
    } else if (data.schoolId && data.schoolId !== user.schoolId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot create a class group for another school');
    }

    const [program, batch] = await withClient(user, async (db) => {
      const p = await db.program.findUnique({ where: { id: data.programId } });
      const b = await db.batch.findUnique({ where: { id: data.batchId } });
      return [p, b] as const;
    });

    if (!program) throw new ApiError(404, 'NOT_FOUND', 'Program not found');
    if (!batch) throw new ApiError(404, 'NOT_FOUND', 'Batch not found');
    if (program.schoolId !== targetSchoolId || batch.schoolId !== targetSchoolId || batch.programId !== program.id) {
      throw new ApiError(400, 'INVALID_BATCH', 'Batch does not belong to the program/school');
    }

    const dup = await withClient(user, (db) =>
      db.classGroup.findFirst({
        where: { programId: data.programId, batchId: data.batchId, section: data.section },
      })
    );
    if (dup) {
      throw new ApiError(409, 'CLASS_EXISTS', 'A class group with this section already exists for the program/batch');
    }

    const created = await withClient(user, (db) =>
      db.classGroup.create({
        data: {
          schoolId: targetSchoolId,
          programId: data.programId,
          batchId: data.batchId,
          section: data.section,
        },
      })
    );

    return successResponse(
      {
        id: created.id,
        schoolId: created.schoolId,
        programId: created.programId,
        batchId: created.batchId,
        section: created.section,
        coordinatorUserId: created.coordinatorUserId,
      },
      201
    );
  } catch (error) {
    return errorResponse(error);
  }
});
