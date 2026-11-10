import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { transferRequestSchema } from '@/lib/student-schemas';
import { findSelfStudent } from '@/lib/student-lifecycle';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/students/[id]/transfer-request — student requests program transfer
// (STUDENT, self). Body: { toProgramId, reason } → 201 { requestId, status }.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { params, user }) => {
  try {
    if (!guardRole(user.role, 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Only students may request a transfer');
    }

    const { id } = params;
    const data = await validateBody(request, transferRequestSchema);

    const requestId = await withClient(user, async (db) => {
      const self = await findSelfStudent(db, user);
      if (!self || self.id !== id) {
        throw new ApiError(403, 'FORBIDDEN', 'Students may only act on their own record');
      }

      const target = await db.program.findFirst({
        where: { id: data.toProgramId },
        select: { id: true },
      });
      if (!target) {
        throw new ApiError(400, 'PROGRAM_NOT_FOUND', 'Target program not found');
      }
      if (target.id === self.programId) {
        throw new ApiError(400, 'SAME_PROGRAM', 'Target program is the same as the current program');
      }

      const transfer = await db.transferRequest.create({
        data: {
          studentId: id,
          fromProgramId: self.programId,
          toProgramId: data.toProgramId,
          reason: data.reason,
          schoolId: user.schoolId,
        },
        select: { id: true },
      });
      return transfer.id;
    });

    return successResponse({ requestId, status: 'PENDING' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
