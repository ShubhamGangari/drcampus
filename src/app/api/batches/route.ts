import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/batches — list batches for the batch options source.
// Auth: any logged-in role. Query: `programId?`.
// - Per-school users ( via `withAuth`'s tenant scoping (their own school).
// - Central 'ALL' users may pass `schoolId` to scope, otherwise see all.
// Returns 200 [{ id, name, academicYear, programId }], ordered by name.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    const url = new URL(request.url);
    const programId = url.searchParams.get('programId');
    const schoolIdParam = url.searchParams.get('schoolId');

    const batches = await withClient(user, async (db) => {
      const where: Record<string, string> = {};
      if (programId) where.programId = programId;
      // Central users use the base (non-scoped) client via withClient; apply an
      // explicit school scope only when a schoolId query is supplied.
      if (isCentralUser(user) && schoolIdParam) {
        where.schoolId = schoolIdParam;
      }

      return db.batch.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        select: { id: true, name: true, academicYear: true, programId: true },
      });
    });

    return successResponse(batches);
  } catch (error) {
    return errorResponse(error);
  }
});
