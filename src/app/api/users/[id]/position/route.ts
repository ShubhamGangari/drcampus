import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { setUserPositionSchema } from '@/lib/validators';
import { requirePermission, getActingUser, assertLegalPosition } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const PUT = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.assign_staff');

    const data = await validateBody(request, setUserPositionSchema);

    const target = await withClient(user, (db) =>
      db.user.findUnique({ where: { id: params.id } })
    );
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'User not found');

    // Non-central users may only affect users inside their own school.
    if (!isCentralUser(user) && target.schoolId !== me.schoolId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot modify a user in another school');
    }

    assertLegalPosition(target.role, data.position);

    const updated = await withClient(user, (db) =>
      db.user.update({
        where: { id: target.id },
        data: { position: data.position },
        select: { id: true, position: true },
      })
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
});
