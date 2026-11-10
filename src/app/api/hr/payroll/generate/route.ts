import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { generatePayrollSchema } from '@/lib/hr-schemas';
import { resolveCreateTenant, designationGross, deductionsFor, computeNet } from '@/lib/hr-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/hr/payroll/generate (REGISTRAR_ADMIN) — generate payroll for all
//   employees of a school for a month. Idempotent: rows that already exist for
//   (employee, month) are skipped. 201 { payrollId, created }.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  if (!guardRole(user.role, 'REGISTRAR_ADMIN')) {
    throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
  }

  const body = await validateBody(request, generatePayrollSchema);
  const tenant = resolveCreateTenant(user, body.schoolId);
  const month = body.month;

  return withClient(user, async (db) => {
    if (user.schoolId === 'ALL') {
      const school = await db.school.findUnique({
        where: { id: tenant },
        select: { id: true },
      });
      if (!school) {
        throw new ApiError(400, 'SCHOOL_NOT_FOUND', 'Target school does not exist');
      }
    }

    const employees = await db.employee.findMany({
      where: { schoolId: tenant },
      select: { id: true, designation: true },
    });

    let created = 0;
    let firstPayrollId: string | null = null;

    for (const emp of employees) {
      const existing = await db.payroll.findUnique({
        where: {
          schoolId_employeeId_month: { schoolId: tenant, employeeId: emp.id, month },
        },
        select: { id: true },
      });
      if (existing) continue;

      const gross = designationGross(emp.designation);
      const deductions = deductionsFor(gross);
      const net = computeNet(gross, deductions);

      const row = await db.payroll.create({
        data: {
          employeeId: emp.id,
          month,
          gross,
          deductions,
          net,
          schoolId: tenant,
        },
        select: { id: true },
      });
      created += 1;
      if (firstPayrollId === null) {
        firstPayrollId = row.id;
      }
    }

    return successResponse({ payrollId: firstPayrollId, created }, 201);
  });
});
