import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { requirePermission, getActingUser } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.view');

    const { searchParams } = new URL(request.url);
    const schoolFilter = searchParams.get('schoolId');
    const departmentFilter = searchParams.get('departmentId');
    const roleFilter = searchParams.get('role');
    const positionFilter = searchParams.get('position');

    const where: Record<string, unknown> = {};
    if (isCentralUser(user)) {
      // Central users (schoolId 'ALL') may view all schools, optionally filtered.
      if (schoolFilter) where.schoolId = schoolFilter;
    } else {
      // Non-central users are always scoped to their own school.
      where.schoolId = me.schoolId;
    }
    if (departmentFilter) where.departmentId = departmentFilter;
    if (roleFilter) where.role = roleFilter;
    if (positionFilter) where.position = positionFilter;

    const staff = await withClient(user, (db) =>
      db.user.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          department: { select: { name: true } },
        },
      })
    );

    const items = staff.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      position: u.position,
      schoolId: u.schoolId,
      departmentId: u.departmentId,
      departmentName: u.department ? u.department.name : null,
    }));

    return successResponse({ items });
  } catch (error) {
    return errorResponse(error);
  }
});
