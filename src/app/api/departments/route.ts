import { prismaBase, withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createDepartmentSchema } from '@/lib/validators';
import { requirePermission, getActingUser } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.view');

    const { searchParams } = new URL(request.url);
    const schoolFilter = searchParams.get('schoolId');

    const where: Record<string, unknown> = {};
    if (isCentralUser(user)) {
      // Central users (schoolId 'ALL') may view all schools, optionally filtered.
      if (schoolFilter) where.schoolId = schoolFilter;
    } else {
      // Non-central users are always scoped to their own school (ignore any filter).
      where.schoolId = me.schoolId;
    }

    const departments = await withClient(user, (db) =>
      db.department.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          head: { select: { id: true, name: true } },
          members: {
            select: { id: true, name: true, email: true, role: true, position: true },
            orderBy: { name: 'asc' },
          },
        },
      })
    );

    const items = departments.map((d) => ({
      id: d.id,
      schoolId: d.schoolId,
      name: d.name,
      code: d.code,
      head: d.head ?? null,
      memberCount: d.members.length,
      staff: d.members,
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
    requirePermission(me, 'org.manage');

    const data = await validateBody(request, createDepartmentSchema);

    let targetSchoolId = user.schoolId;
    if (isCentralUser(user)) {
      if (!data.schoolId) {
        throw new ApiError(400, 'SCHOOL_REQUIRED', 'Central officers must specify a schoolId');
      }
      targetSchoolId = data.schoolId;
      const schoolExists = await prismaBase.school.findUnique({ where: { id: targetSchoolId } });
      if (!schoolExists) {
        throw new ApiError(404, 'NOT_FOUND', 'Specified school not found');
      }
    } else if (data.schoolId && data.schoolId !== user.schoolId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot create a department for another school');
    }

    const dup = await withClient(user, (db) =>
      db.department.findFirst({ where: { schoolId: targetSchoolId, code: data.code } })
    );
    if (dup) {
      throw new ApiError(409, 'DEPT_EXISTS', 'A department with this code already exists in the school');
    }

    const department = await withClient(user, (db) =>
      db.department.create({
        data: { schoolId: targetSchoolId, name: data.name, code: data.code },
      })
    );

    return successResponse(
      {
        id: department.id,
        schoolId: department.schoolId,
        name: department.name,
        code: department.code,
        headUserId: department.headUserId,
        createdAt: department.createdAt,
      },
      201
    );
  } catch (error) {
    return errorResponse(error);
  }
});
