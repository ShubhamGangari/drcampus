import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { findSelfStudent } from '@/lib/student-lifecycle';

export const dynamic = 'force-dynamic';

const LIST_ROLES = ['REGISTRAR_ADMIN', 'STUDENT'];

const STUDENT_SNAPSHOT = {
  select: { id: true, rollNo: true, firstName: true, lastName: true },
};

// ---------------------------------------------------------------------------
// GET /api/students/leaves — list leave requests.
// REGISTRAR_ADMIN sees all (school-scoped, or all schools for central);
// STUDENT sees their own only. Returns a bare array.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!LIST_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Not authorized to view leave requests');
    }

    const rows = await withClient(user, async (db) => {
      const where: Record<string, unknown> = {};
      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) return [];
        where.studentId = self.id;
      }

      return db.leaveRequest.findMany({
        where,
        orderBy: [{ requestedAt: 'desc' }],
        include: { student: STUDENT_SNAPSHOT },
      });
    });

    return successResponse(rows);
  } catch (error) {
    return errorResponse(error);
  }
});
