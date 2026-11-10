import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { createEmployeeSchema } from '@/lib/hr-schemas';
import { resolveCreateTenant } from '@/lib/hr-core';

export const dynamic = 'force-dynamic';

const CREATE_ROLES = ['REGISTRAR_ADMIN'];
const LIST_ROLES = ['REGISTRAR_ADMIN', 'FINANCE_OFFICER', 'FACULTY'];

const EMPLOYEE_SELECT = {
  id: true,
  employeeId: true,
  name: true,
  designation: true,
  department: true,
  userId: true,
} as const;

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
// GET /api/hr/employees?schoolId= — list (REGISTRAR_ADMIN, FINANCE_OFFICER,
//   FACULTY). Faculty sees only their own record(s).
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  if (!LIST_ROLES.includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to employees');
  }

  const url = new URL(request.url);
  const schoolQuery = url.searchParams.get('schoolId');

  return withClient(user, async (db) => {
    const tenant = resolveQueryTenant(user, schoolQuery);
    const where: Record<string, unknown> = { schoolId: tenant };
    if (user.role === 'FACULTY') {
      where.userId = user.userId;
    }
    const employees = await db.employee.findMany({
      where,
      select: EMPLOYEE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return successResponse(employees);
  });
});

// ---------------------------------------------------------------------------
// POST /api/hr/employees — create employee (REGISTRAR_ADMIN). 201 { id }
//   Duplicate employeeId in the same tenant -> 400.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  if (!CREATE_ROLES.includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
  }

  const body = await validateBody(request, createEmployeeSchema);
  const tenant = resolveCreateTenant(user, body.schoolId);

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

    const existing = await db.employee.findFirst({
      where: { schoolId: tenant, employeeId: body.employeeId },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError(400, 'DUPLICATE_EMPLOYEE', 'An employee with this employeeId already exists in the school');
    }

    const employee = await db.employee.create({
      data: {
        employeeId: body.employeeId,
        name: body.name,
        designation: body.designation,
        department: body.department,
        schoolId: tenant,
        ...(body.userId ? { userId: body.userId } : {}),
      },
      select: { id: true },
    });
    return successResponse({ id: employee.id }, 201);
  });
});
