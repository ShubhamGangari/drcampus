import { withClient } from '@/lib/prisma';
import { withAuth, errorResponse, ApiError } from '@/lib/api';
import { requirePermission, getActingUser } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const DELETE = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.allocate_course');

    const allocation = await withClient(user, (db) =>
      db.facultyAllocation.findUnique({
        where: { id: params.id },
        include: {
          classGroup: { include: { program: { select: { id: true, coordinatorUserId: true } } } },
        },
      })
    );
    if (!allocation) throw new ApiError(404, 'NOT_FOUND', 'Allocation not found');

    if (me.role === 'REGISTRAR_ADMIN') {
      // allowed
    } else if (me.position === 'HOD') {
      if (allocation.departmentId !== me.departmentId) {
        throw new ApiError(403, 'FORBIDDEN', 'HOD may only delete allocations within their own department');
      }
    } else if (me.position === 'PROGRAM_COORDINATOR') {
      if (allocation.classGroup.program.coordinatorUserId !== me.id) {
        throw new ApiError(403, 'FORBIDDEN', 'Program coordinator may only delete allocations for their own program');
      }
    } else {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to delete allocations');
    }

    await withClient(user, (db) =>
      db.facultyAllocation.delete({ where: { id: allocation.id } })
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
});
