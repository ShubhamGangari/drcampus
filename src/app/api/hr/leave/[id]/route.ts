import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { updateLeaveStatusSchema } from '@/lib/hr-schemas';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/hr/leave/[id] (REGISTRAR_ADMIN) — approve/reject a leave request.
//   Body { status: "APPROVED" | "REJECTED" } -> 200 { id, status }.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
  if (!guardRole(user.role, 'REGISTRAR_ADMIN')) {
    throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
  }

  const { id } = params;
  const body = await validateBody(request, updateLeaveStatusSchema);

  return withClient(user, async (db) => {
    const leave = await db.employeeLeave.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!leave) {
      throw new ApiError(404, 'NOT_FOUND', 'Leave request not found');
    }

    const updated = await db.employeeLeave.update({
      where: { id },
      data: { status: body.status },
      select: { id: true, status: true },
    });
    return successResponse({ id: updated.id, status: updated.status });
  });
});
