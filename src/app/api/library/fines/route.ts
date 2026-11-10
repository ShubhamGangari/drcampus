import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { tenantFilter, userHasPermission, daysOverdue } from '@/lib/library-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/library/fines?schoolId=  (library.view | library.manage)
//   200 { fines: [{ id, loanId, memberId, daysOverdue, amount, status }] }
// Fines are derived from loans that carry a fine. `daysOverdue` is computed
// live from the loan's due date (or return date for returned loans).
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const canView = (await userHasPermission(user, 'library.view')) ||
            (await userHasPermission(user, 'library.manage'));
        if (!canView) {
            throw new ApiError(403, 'FORBIDDEN', 'Library view permission required');
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const fines = await withClient(user, async (db) => {
            const where: Record<string, unknown> = {
                ...tenantFilter(isCentralUser(user), schoolId),
                fine: { gt: 0 },
            };
            const rows = await db.libraryLoan.findMany({
                where,
                orderBy: { dueDate: 'desc' },
                include: { membership: { select: { userId: true } } },
            });

            const today = new Date();
            return rows.map((r) => {
                const refDate = r.returnDate ?? today;
                return {
                    id: r.id,
                    loanId: r.id,
                    memberId: r.membership.userId,
                    daysOverdue: daysOverdue(refDate, r.dueDate),
                    amount: r.fine,
                    status: r.fineStatus,
                };
            });
        });

        return successResponse({ fines });
    } catch (error) {
        return errorResponse(error);
    }
});
