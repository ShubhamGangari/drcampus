import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, ApiError } from '@/lib/api';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/hr/employees/me (FACULTY) — current faculty's own employee record.
//  200 { id, employeeId, name, designation, department } | 404 if not registered.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_request, { user }) => {
  if (!guardRole(user.role, 'FACULTY')) {
    throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
  }

  return withClient(user, async (db) => {
    const employee = await db.employee.findFirst({
      where: { userId: user.userId },
      select: {
        id: true,
        employeeId: true,
        name: true,
        designation: true,
        department: true,
      },
    });
    if (!employee) {
      throw new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'No employee record found for this faculty member');
    }
    return successResponse(employee);
  });
});
