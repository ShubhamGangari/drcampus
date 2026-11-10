import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { reviewStatusSchema } from '@/lib/student-schemas';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

const REVIEW_ROLES = ['REGISTRAR_ADMIN'];

// ---------------------------------------------------------------------------
// PATCH /api/students/leave-requests/[id] — review leave request
// (REGISTRAR_ADMIN). Body: { status: "APPROVED"|"REJECTED", remarks? }.
// On APPROVED, also sets the student's status to ON_LEAVE.
// → 200 { id, status }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { params, user }) => {
  try {
    if (!REVIEW_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
    }

    const { id } = params;
    const data = await validateBody(request, reviewStatusSchema);

    const result = await withClient(user, async (db) => {
      const current = await db.leaveRequest.findUnique({
        where: { id },
        include: { student: { select: { id: true } } },
      });
      if (!current) {
        throw new ApiError(404, 'NOT_FOUND', 'Leave request not found');
      }
      if (current.status !== 'PENDING') {
        throw new ApiError(409, 'INVALID_TRANSITION', 'Only pending requests can be reviewed');
      }

      const updated = await db.leaveRequest.update({
        where: { id },
        data: { status: data.status, remarks: data.remarks },
        select: { id: true, status: true },
      });

      if (data.status === 'APPROVED') {
        await db.student.update({
          where: { id: current.student.id },
          data: { status: 'ON_LEAVE' },
        });
      }

      await writeAuditLog(db, {
        schoolId: current.schoolId,
        actorId: user.userId,
        action: 'LEAVE_REQUEST_REVIEWED',
        entityType: 'LEAVE_REQUEST',
        entityId: id,
        summary: `Leave request ${data.status.toLowerCase()} for student ${current.student.id}`,
      });

      return updated;
    });

    return successResponse({ id: result.id, status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
});
