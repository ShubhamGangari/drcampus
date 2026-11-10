import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { setUserDepartmentSchema } from '@/lib/validators';
import { requirePermission, getActingUser, assertLegalPosition } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const PUT = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.assign_staff');

    const data = await validateBody(request, setUserDepartmentSchema);

    const target = await withClient(user, (db) =>
      db.user.findUnique({ where: { id: params.id } })
    );
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'User not found');

    // Non-central users may only affect users inside their own school.
    if (!isCentralUser(user) && target.schoolId !== me.schoolId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot modify a user in another school');
    }

    const targetDept = await withClient(user, (db) =>
      db.department.findUnique({ where: { id: data.departmentId } })
    );
    if (!targetDept) throw new ApiError(404, 'NOT_FOUND', 'Department not found');

    // A user may only belong to a department inside their own school.
    if (targetDept.schoolId !== target.schoolId) {
      throw new ApiError(400, 'INVALID_DEPARTMENT', 'Department does not belong to the user\'s school');
    }

    if (data.position !== undefined) {
      assertLegalPosition(target.role, data.position);
    }

    const updated = await withClient(user, (db) =>
      db.user.update({
        where: { id: target.id },
        data: {
          departmentId: data.departmentId,
          ...(data.position !== undefined ? { position: data.position } : {}),
        },
        select: { id: true, departmentId: true, position: true },
      })
    );

    // Central officer operating across schools must still respect per-school scoping
    // for writes â€” the extended client handles that for school users automatically.

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
});
