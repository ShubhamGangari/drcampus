import { withClient } from '@/lib/prisma';
import { withAuth, errorResponse, ApiError } from '@/lib/api';
import { requirePermission, getActingUser } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const DELETE = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.manage_classes');

    const classGroup = await withClient(user, (db) =>
      db.classGroup.findUnique({
        where: { id: params.id },
        include: { _count: { select: { allocations: true } } },
      })
    );
    if (!classGroup) throw new ApiError(404, 'NOT_FOUND', 'Class group not found');

    if (classGroup._count.allocations > 0) {
      throw new ApiError(409, 'CLASS_HAS_ALLOCATIONS', 'Class group is referenced by course allocations and cannot be deleted');
    }

    await withClient(user, (db) =>
      db.classGroup.delete({ where: { id: classGroup.id } })
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
});
