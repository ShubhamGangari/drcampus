import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateDepartmentSchema } from '@/lib/validators';
import { requirePermission, getActingUser } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.view');

    const department = await withClient(user, (db) =>
      db.department.findUnique({
        where: { id: params.id },
        include: {
          head: { select: { id: true, name: true } },
          members: {
            select: { id: true, name: true, email: true, role: true, position: true },
            orderBy: { name: 'asc' },
          },
        },
      })
    );
    if (!department) throw new ApiError(404, 'NOT_FOUND', 'Department not found');

    return successResponse({
      id: department.id,
      schoolId: department.schoolId,
      name: department.name,
      code: department.code,
      head: department.head ?? null,
      staff: department.members,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

export const PATCH = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.manage');

    const data = await validateBody(request, updateDepartmentSchema);

    const department = await withClient(user, (db) =>
      db.department.findUnique({ where: { id: params.id } })
    );
    if (!department) throw new ApiError(404, 'NOT_FOUND', 'Department not found');

    // Non-central users may only modify departments inside their own school.
    if (!isCentralUser(user) && department.schoolId !== me.schoolId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot modify a department in another school');
    }

    let nextCode = department.code;
    if (data.code !== undefined && data.code !== department.code) {
      nextCode = data.code;
      const dup = await withClient(user, (db) =>
        db.department.findFirst({
          where: { schoolId: department.schoolId, code: nextCode, NOT: { id: department.id } },
        })
      );
      if (dup) {
        throw new ApiError(409, 'DEPT_EXISTS', 'A department with this code already exists in the school');
      }
    }

    const updated = await withClient(user, (db) =>
      db.department.update({
        where: { id: department.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.code !== undefined ? { code: nextCode } : {}),
        },
      })
    );

    return successResponse({
      id: updated.id,
      schoolId: updated.schoolId,
      name: updated.name,
      code: updated.code,
      headUserId: updated.headUserId,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.manage');

    const department = await withClient(user, (db) =>
      db.department.findUnique({
        where: { id: params.id },
        include: { _count: { select: { members: true } } },
      })
    );
    if (!department) throw new ApiError(404, 'NOT_FOUND', 'Department not found');

    // Non-central users may only delete departments inside their own school.
    if (!isCentralUser(user) && department.schoolId !== me.schoolId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot delete a department in another school');
    }

    if (department._count.members > 0) {
      throw new ApiError(409, 'DEPT_NOT_EMPTY', 'Department has assigned staff and cannot be deleted');
    }

    await withClient(user, (db) => db.department.delete({ where: { id: department.id } }));

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
});
