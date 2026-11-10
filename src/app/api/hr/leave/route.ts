import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { createLeaveSchema } from '@/lib/hr-schemas';
import { isValidLeaveType } from '@/lib/hr-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const LIST_ROLES = ['REGISTRAR_ADMIN', 'FINANCE_OFFICER', 'FACULTY'];

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
// GET /api/hr/leave?schoolId= — list leave requests (REGISTRAR_ADMIN,
//   FINANCE_OFFICER, FACULTY). Faculty see only their own.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  if (!LIST_ROLES.includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to leave requests');
  }

  const url = new URL(request.url);
  const schoolQuery = url.searchParams.get('schoolId');

  return withClient(user, async (db) => {
    const tenant = resolveQueryTenant(user, schoolQuery);

    let employeeIds: string[] = [];
    if (user.role === 'FACULTY') {
      const emps = await db.employee.findMany({
        where: { schoolId: tenant, userId: user.userId },
        select: { id: true },
      });
      employeeIds = emps.map((e) => e.id);
      if (employeeIds.length === 0) {
        return successResponse([]);
      }
    }

    const whereLeave: Record<string, unknown> = { schoolId: tenant };
    if (user.role === 'FACULTY') {
      whereLeave.employeeId = { in: employeeIds };
    }

    const leaves = await db.employeeLeave.findMany({
      where: whereLeave,
      orderBy: { createdAt: 'desc' },
    });

    const empIds = Array.from(new Set(leaves.map((l) => l.employeeId)));
    const employees = await db.employee.findMany({
      where: { schoolId: tenant, id: { in: empIds } },
      select: { id: true, employeeId: true, name: true },
    });
    const empMap = new Map<string, { id: string; employeeId: string; name: string }>(
      employees.map((e) => [e.id, e])
    );

    const rows = leaves.map((l) => ({
      id: l.id,
      employeeId: empMap.get(l.employeeId)?.employeeId ?? null,
      employeeName: empMap.get(l.employeeId)?.name ?? null,
      fromDate: l.fromDate.toISOString(),
      toDate: l.toDate.toISOString(),
      type: l.type,
      status: l.status,
    }));
    return successResponse(rows);
  });
});

// ---------------------------------------------------------------------------
// POST /api/hr/leave (FACULTY) — apply for leave; employee derived from JWT
//   userId. 201 { requestId } | 400 invalid type / bad date range.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  if (!guardRole(user.role, 'FACULTY')) {
    throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
  }

  const body = await validateBody(request, createLeaveSchema);

  if (!isValidLeaveType(body.type)) {
    throw new ApiError(400, 'INVALID_LEAVE_TYPE', 'Invalid leave type');
  }

  const from = new Date(body.fromDate);
  const to = new Date(body.toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(400, 'INVALID_DATE', 'Invalid date value');
  }
  if (from.getTime() > to.getTime()) {
    throw new ApiError(400, 'INVALID_DATE_RANGE', 'fromDate cannot be after toDate');
  }

  return withClient(user, async (db) => {
    const employee = await db.employee.findFirst({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!employee) {
      throw new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'No employee record found for this faculty member');
    }

    const leave = await db.employeeLeave.create({
      data: { employeeId: employee.id, fromDate: from, toDate: to, type: body.type, schoolId: user.schoolId },
      select: { id: true },
    });
    return successResponse({ requestId: leave.id }, 201);
  });
});
