import { withClient } from '@/lib/prisma';
import { withAuth, errorResponse, ApiError } from '@/lib/api';
import { requirePermission, getActingUser } from '@/lib/org';
import { requireManageSlot } from '@/lib/academic-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// DELETE /api/academic/timetable/[id] — delete slot (timetable.manage). 204.
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'timetable.manage');

    return await withClient(user, async (db) => {
      const slot = await db.timetableSlot.findUnique({
        where: { id: params.id },
        include: {
          classGroup: {
            include: { program: { select: { coordinatorUserId: true } } },
          },
        },
      });
      if (!slot) throw new ApiError(404, 'NOT_FOUND', 'Timetable slot not found');

      requireManageSlot(me, { classGroup: slot.classGroup });

      await db.timetableSlot.delete({ where: { id: slot.id } });
      return new Response(null, { status: 204 });
    });
  } catch (error) {
    return errorResponse(error);
  }
});
