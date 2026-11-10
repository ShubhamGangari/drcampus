import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { leaveRequestSchema } from '@/lib/student-schemas';
import { findSelfStudent, hasLeaveOverlap } from '@/lib/student-lifecycle';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/students/[id]/leave-request — student requests leave (STUDENT, self).
// Body: { type, fromDate, toDate, reason } → 201 { requestId, status: "PENDING" }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { params, user }) => {
  try {
    if (!guardRole(user.role, 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Only students may request leave');
    }

    const { id } = params;
    const data = await validateBody(request, leaveRequestSchema);

    const requestId = await withClient(user, async (db) => {
      const self = await findSelfStudent(db, user);
      if (!self || self.id !== id) {
        throw new ApiError(403, 'FORBIDDEN', 'Students may only act on their own record');
      }

      if (self.status === 'ON_LEAVE') {
        throw new ApiError(400, 'OVERLAPPING_LEAVE', 'Student is currently on leave');
      }

      const approvedLeaves = await db.leaveRequest.findMany({
        where: { studentId: id, status: 'APPROVED' },
        select: { fromDate: true, toDate: true },
      });
      if (hasLeaveOverlap(approvedLeaves, data.fromDate, data.toDate)) {
        throw new ApiError(400, 'OVERLAPPING_LEAVE', 'An approved leave overlaps the requested period');
      }

      const leave = await db.leaveRequest.create({
        data: {
          studentId: id,
          type: data.type,
          fromDate: data.fromDate,
          toDate: data.toDate,
          reason: data.reason,
          schoolId: user.schoolId,
        },
        select: { id: true },
      });
      return leave.id;
    });

    return successResponse({ requestId, status: 'PENDING' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
