import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { reviewStatusSchema } from '@/lib/student-schemas';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

const REVIEW_ROLES = ['REGISTRAR_ADMIN'];

// ---------------------------------------------------------------------------
// PATCH /api/students/transfer-requests/[id] — review transfer request
// (REGISTRAR_ADMIN). Body: { status, remarks? }.
// On APPROVED, also moves the student to the requested program.
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
      const current = await db.transferRequest.findUnique({
        where: { id },
        include: { student: { select: { id: true } } },
      });
      if (!current) {
        throw new ApiError(404, 'NOT_FOUND', 'Transfer request not found');
      }
      if (current.status !== 'PENDING') {
        throw new ApiError(409, 'INVALID_TRANSITION', 'Only pending requests can be reviewed');
      }

      const updated = await db.transferRequest.update({
        where: { id },
        data: { status: data.status, remarks: data.remarks },
        select: { id: true, status: true },
      });

      if (data.status === 'APPROVED') {
        await db.student.update({
          where: { id: current.student.id },
          data: { programId: current.toProgramId, status: 'TRANSFERRED' },
        });
      }

      await writeAuditLog(db, {
        schoolId: current.schoolId,
        actorId: user.userId,
        action: 'TRANSFER_REQUEST_REVIEWED',
        entityType: 'TRANSFER_REQUEST',
        entityId: id,
        summary: `Transfer request ${data.status.toLowerCase()} for student ${current.student.id}`,
      });

      return updated;
    });

    return successResponse({ id: result.id, status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
});
