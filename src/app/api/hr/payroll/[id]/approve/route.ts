import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, ApiError } from '@/lib/api';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/hr/payroll/[id]/approve (FINANCE_OFFICER) — finalize payroll.
//   -> 200 { id, status: "APPROVED" }.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (_request, { user, params }) => {
  if (!guardRole(user.role, 'FINANCE_OFFICER')) {
    throw new ApiError(403, 'FORBIDDEN', 'Finance officer access required');
  }

  const { id } = params;

  return withClient(user, async (db) => {
    const payroll = await db.payroll.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!payroll) {
      throw new ApiError(404, 'NOT_FOUND', 'Payroll record not found');
    }

    const updated = await db.payroll.update({
      where: { id },
      data: { status: 'APPROVED' },
      select: { id: true, status: true },
    });
    return successResponse({ id: updated.id, status: updated.status });
  });
});
