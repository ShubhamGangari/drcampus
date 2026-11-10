import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { returnLoanSchema } from '@/lib/library-schemas';
import { userHasPermission, computeFine, daysOverdue, LOAN_STATUS } from '@/lib/library-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/library/loans/[id]/return — record a return (library.manage).
// Body `{ fine?: number }` — when omitted the fine is computed automatically
// from the overdue days (₹5/day, ₹500 cap). Sets status RETURNED, returnDate,
// marks the copy available again, and records fineStatus.
//   200 { loan }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library management permission required');
        }

        const body = await validateBody(request, returnLoanSchema);
        const id = params.id;

        const loan = await withClient(user, async (db) => {
            const existing = await db.libraryLoan.findUnique({
                where: { id },
                include: { copy: { select: { id: true } } },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Loan not found');
            }
            if (existing.status === LOAN_STATUS.RETURNED) {
                throw new ApiError(400, 'ALREADY_RETURNED', 'This loan has already been returned');
            }

            const today = new Date();
            const overdue = daysOverdue(today, existing.dueDate);
            const fine = body.fine !== undefined ? body.fine : computeFine(overdue);
            const fineStatus = fine > 0 ? 'UNPAID' : 'PAID';

            await db.libraryLoan.update({
                where: { id },
                data: {
                    status: LOAN_STATUS.RETURNED,
                    returnDate: today,
                    fine,
                    fineStatus,
                },
            });

            // Release the copy.
            await db.libraryCopy.update({
                where: { id: existing.copy.id },
                data: { available: true },
            });

            return {
                id: existing.id,
                copyId: existing.copyId,
                memberId: existing.memberId,
                issueDate: existing.issueDate.toISOString(),
                dueDate: existing.dueDate.toISOString(),
                returnDate: today.toISOString(),
                status: LOAN_STATUS.RETURNED,
                fine,
                fineStatus,
            };
        });

        return successResponse({ loan });
    } catch (error) {
        return errorResponse(error);
    }
});
