import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { tenantFilter, userHasPermission } from '@/lib/library-core';

/**
 * List physical copies of a book (read-only supporting endpoint for the library
 * Issue screen, which must select a specific copy id to open a loan). Not part
 * of the frozen write-contract, but required to drive the /library/circulation
 * UI. Scoped by tenant; readable by any user with library.view/manage.
 */
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'library.view')) && !(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library view permission required');
        }

        const url = new URL(request.url);
        const seg = url.pathname.split('/');
        const id = seg[seg.length - 2]; // .../books/[id]/copies

        const copies = await withClient(user, async (db) => {
            const where: Record<string, unknown> = {
                bookId: id,
                ...tenantFilter(isCentralUser(user), user.schoolId),
            };
            return db.libraryCopy.findMany({
                where,
                orderBy: { accessionNo: 'asc' },
                select: { id: true, accessionNo: true, available: true },
            });
        });

        return successResponse({ copies });
    } catch (error) {
        return errorResponse(error);
    }
});
