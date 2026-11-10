import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { userHasPermission } from '@/lib/library-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/library/fines/[id]/pay — mark a fine paid (library.manage). 200 { fine }
// `id` is the loan id the fine belongs to.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (_request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library management permission required');
        }

        const id = params.id;

        const fine = await withClient(user, async (db) => {
            const loan = await db.libraryLoan.findUnique({ where: { id } });
            if (!loan) {
                throw new ApiError(404, 'NOT_FOUND', 'Loan not found');
            }
            if (loan.fine <= 0) {
                throw new ApiError(400, 'NO_FINE', 'This loan has no fine to pay');
            }

            await db.libraryLoan.update({
                where: { id },
                data: { fineStatus: 'PAID' },
            });

            return {
                id: loan.id,
                loanId: loan.id,
                amount: loan.fine,
                status: 'PAID',
            };
        });

        return successResponse({ fine });
    } catch (error) {
        return errorResponse(error);
    }
});
