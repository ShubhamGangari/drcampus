import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Admin roles allowed to list schools. Central officers see every school; a
// school-scoped officer sees only their own school.
const ADMIN_ROLES = new Set(['FINANCE_OFFICER', 'REGISTRAR_ADMIN', 'DEAN']);

// ---------------------------------------------------------------------------
// GET /api/fees/schools — list schools (for central-officer writes).
// Central officer: 200 [{ id, name }] for all schools.
// School-scoped officer: 200 [{ id, name }] for their own school only.
// 403 non-admin role.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_request, { user }) => {
  try {
    if (!ADMIN_ROLES.has(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
    }

    return await withClient(user, async (db) => {
      if (user.schoolId === 'ALL') {
        const schools = await db.school.findMany({
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        });
        return successResponse(schools);
      }

      const school = await db.school.findUnique({
        where: { id: user.schoolId },
        select: { id: true, name: true },
      });
      return successResponse(school ? [school] : []);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
