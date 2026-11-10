import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const VIEW_ROLES = ['REGISTRAR_ADMIN', 'FINANCE_OFFICER'];

const resolveQueryTenant = (user: { schoolId: string }, query: string | null): string => {
  if (user.schoolId === 'ALL') {
    if (!query) {
      throw new ApiError(400, 'SCHOOL_ID_REQUIRED', 'Central officers must specify a schoolId');
    }
    return query;
  }
  return user.schoolId;
};

// ---------------------------------------------------------------------------
// GET /api/hr/payroll?schoolId=&month= (REGISTRAR_ADMIN, FINANCE_OFFICER)
//   200 [{ id, employeeId, employeeName, month, gross, deductions, net, status }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  if (!VIEW_ROLES.includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to payroll');
  }

  const url = new URL(request.url);
  const schoolQuery = url.searchParams.get('schoolId');
  const month = url.searchParams.get('month');

  return withClient(user, async (db) => {
    const tenant = resolveQueryTenant(user, schoolQuery);

    const wherePayroll: Record<string, unknown> = { schoolId: tenant };
    if (month) {
      wherePayroll.month = month;
    }

    const rows = await db.payroll.findMany({
      where: wherePayroll,
      orderBy: [{ month: 'desc' }, { createdAt: 'asc' }],
    });

    const empIds = Array.from(new Set(rows.map((r) => r.employeeId)));
    const employees = await db.employee.findMany({
      where: { schoolId: tenant, id: { in: empIds } },
      select: { id: true, employeeId: true, name: true },
    });
    const empMap = new Map<string, { id: string; employeeId: string; name: string }>(
      employees.map((e) => [e.id, e])
    );

    const result = rows.map((r) => ({
      id: r.id,
      employeeId: empMap.get(r.employeeId)?.employeeId ?? null,
      employeeName: empMap.get(r.employeeId)?.name ?? null,
      month: r.month,
      gross: r.gross,
      deductions: r.deductions,
      net: r.net,
      status: r.status,
    }));
    return successResponse(result);
  });
});
