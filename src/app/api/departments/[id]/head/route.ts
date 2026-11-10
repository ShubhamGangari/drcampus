import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { setDepartmentHeadSchema } from '@/lib/validators';
import { requirePermission, getActingUser } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const PUT = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.manage');

    const data = await validateBody(request, setDepartmentHeadSchema);

    const department = await withClient(user, (db) =>
      db.department.findUnique({ where: { id: params.id } })
    );
    if (!department) throw new ApiError(404, 'NOT_FOUND', 'Department not found');

    // Non-central users may only set heads for departments inside their own school.
    if (!isCentralUser(user) && department.schoolId !== me.schoolId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot modify a department in another school');
    }

    let headUserId: string | null = null;
    if (data.headUserId) {
      const target = await withClient(user, (db) =>
        db.user.findUnique({
          where: { id: data.headUserId! },
          select: { id: true, role: true, position: true },
        })
      );
      if (!target || target.role !== 'DEAN' || target.position !== 'HOD') {
        throw new ApiError(400, 'NOT_HOD', 'Department head must be a user with HOD position (DEAN base role)');
      }
      headUserId = target.id;
    }

    const updated = await withClient(user, (db) =>
      db.department.update({
        where: { id: department.id },
        data: { headUserId },
      })
    );

    return successResponse({
      id: updated.id,
      headUserId: updated.headUserId,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
