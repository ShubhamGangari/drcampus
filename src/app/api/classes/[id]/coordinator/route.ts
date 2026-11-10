import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { setClassCoordinatorSchema } from '@/lib/validators';
import { requirePermission, getActingUser } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const PUT = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.manage_classes');

    const data = await validateBody(request, setClassCoordinatorSchema);

    const classGroup = await withClient(user, (db) =>
      db.classGroup.findUnique({ where: { id: params.id } })
    );
    if (!classGroup) throw new ApiError(404, 'NOT_FOUND', 'Class group not found');

    const target = await withClient(user, (db) =>
      db.user.findUnique({
        where: { id: data.coordinatorUserId },
        select: { id: true, role: true, position: true },
      })
    );
    if (!target || (target.role !== 'FACULTY' && target.position !== 'CLASS_COORDINATOR')) {
      throw new ApiError(400, 'INVALID_COORDINATOR', 'Class coordinator must be a FACULTY-based user');
    }

    const updated = await withClient(user, (db) =>
      db.classGroup.update({
        where: { id: classGroup.id },
        data: { coordinatorUserId: target.id },
        select: { id: true, coordinatorUserId: true },
      })
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
});
