import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, ApiError } from '@/lib/api';
import { MONTH_REGEX } from '@/lib/hr-schemas';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/hr/payslip?month= (FACULTY) — own payslip for a month.
//   200 { id, employeeId, employeeName, month, gross, deductions, net, status }
//   | 404 if no employee record or no payslip for the month.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  if (!guardRole(user.role, 'FACULTY')) {
    throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
  }

  const url = new URL(request.url);
  const month = url.searchParams.get('month');
  if (!month || !MONTH_REGEX.test(month)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'month is required in YYYY-MM format');
  }

  return withClient(user, async (db) => {
    const employee = await db.employee.findFirst({
      where: { userId: user.userId },
      select: { id: true, employeeId: true, name: true },
    });
    if (!employee) {
      throw new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'No employee record found for this faculty member');
    }

    const slip = await db.payroll.findFirst({
      where: { employeeId: employee.id, month },
      select: { id: true, month: true, gross: true, deductions: true, net: true, status: true },
    });
    if (!slip) {
      throw new ApiError(404, 'PAYSLIP_NOT_FOUND', 'No payslip found for this month');
    }

    return successResponse({
      id: slip.id,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      month: slip.month,
      gross: slip.gross,
      deductions: slip.deductions,
      net: slip.net,
      status: slip.status,
    });
  });
});
