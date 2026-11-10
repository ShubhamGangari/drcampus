import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createMessBillSchema } from '@/lib/hostel-schemas';
import {
  resolveCreateTenant,
  assertStudentBelongsToSchool,
  roundMoney2,
} from '@/lib/hostel-core';

export const dynamic = 'force-dynamic';

const BILL_ROLES = ['FINANCE_OFFICER', 'REGISTRAR_ADMIN'] as const;

// ---------------------------------------------------------------------------
// POST /api/hostel/mess/bill — create a mess bill for a student+month.
// FINANCE_OFFICER / REGISTRAR_ADMIN. 201 { billId }
//   400 amount <= 0 (zod) | 404 student missing | 409 duplicate student+month
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!BILL_ROLES.includes(user.role as (typeof BILL_ROLES)[number])) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer or registrar access required');
    }

    const body = await validateBody(request, createMessBillSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    const billId = await withClient(user, async (db) => {
      await assertStudentBelongsToSchool(db, body.studentId, tenant);

      const dupWhere: Record<string, unknown> = {
        studentId: body.studentId,
        month: body.month,
      };
      if (isCentralUser(user)) dupWhere.schoolId = tenant;

      const existing = await db.messBill.findFirst({ where: dupWhere });
      if (existing) {
        throw new ApiError(
          409,
          'DUPLICATE_BILL',
          'A mess bill already exists for this student and month'
        );
      }

      const bill = await db.messBill.create({
        data: {
          studentId: body.studentId,
          month: body.month,
          amount: roundMoney2(body.amount),
          schoolId: tenant,
        },
      });
      return bill.id as string;
    });

    return successResponse({ billId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
