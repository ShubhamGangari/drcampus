import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { markMessBillPaidSchema } from '@/lib/hostel-schemas';

export const dynamic = 'force-dynamic';

const BILL_ROLES = ['FINANCE_OFFICER', 'REGISTRAR_ADMIN'] as const;

// ---------------------------------------------------------------------------
// POST /api/hostel/mess/paid — mark a mess bill as paid.
// FINANCE_OFFICER / REGISTRAR_ADMIN. 200 { paid: true }
//   404 bill not found. Idempotent: already-paid bills return paid:true.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!BILL_ROLES.includes(user.role as (typeof BILL_ROLES)[number])) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer or registrar access required');
    }

    const body = await validateBody(request, markMessBillPaidSchema);

    await withClient(user, async (db) => {
      // billId is globally unique; central users find by id across schools, and
      // the extended client auto-scopes school users to their own tenant.
      const bill = await db.messBill.findUnique({ where: { id: body.billId } });
      if (!bill) {
        throw new ApiError(404, 'NOT_FOUND', 'Mess bill not found');
      }

      if (!bill.paid) {
        await db.messBill.update({
          where: { id: body.billId },
          data: { paid: true },
        });
      }
    });

    return successResponse({ paid: true });
  } catch (error) {
    return errorResponse(error);
  }
});
