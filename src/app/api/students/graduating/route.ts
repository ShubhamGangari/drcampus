import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { isGraduateEligible } from '@/lib/student-lifecycle';

export const dynamic = 'force-dynamic';

const GRADUATE_ROLES = ['REGISTRAR_ADMIN'];

// ---------------------------------------------------------------------------
// GET /api/students/graduating?batchId= — eligible graduates (REGISTRAR_ADMIN).
// Returns ACTIVE students with at least one enrollment and not already graduated.
// A bare array of student summaries.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!GRADUATE_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
    }

    const url = new URL(request.url);
    const batchId = url.searchParams.get('batchId');

    const students = await withClient(user, async (db) => {
      const candidates = await db.student.findMany({
        where: {
          status: 'ACTIVE',
          ...(batchId ? { batchId } : {}),
        },
        select: {
          id: true,
          rollNo: true,
          firstName: true,
          lastName: true,
          email: true,
          programId: true,
          batchId: true,
          status: true,
          _count: { select: { enrollments: true } },
        },
      });

      return candidates
        .filter((s) => isGraduateEligible(s, s._count.enrollments > 0))
        .map((s) => {
          const { _count, ...rest } = s;
          void _count;
          return rest;
        });
    });

    return successResponse(students);
  } catch (error) {
    return errorResponse(error);
  }
});
