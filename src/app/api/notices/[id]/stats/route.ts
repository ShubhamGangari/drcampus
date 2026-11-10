import { withClient, prismaBase } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { userHasPermission, requireNoticesManage } from '@/lib/notices-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/notices/[id]/stats — read count for a notice (notices.manage).
// The notice is resolved through the tenant-scoped client; reads are counted on
// base client (NoticeRead has no schoolId column).
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'notices.manage'))) {
            throw requireNoticesManage();
        }

        const id = params.id;

        await withClient(user, async (db) => {
            const existing = await db.notice.findUnique({ where: { id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Notice not found');
            }
        });

        const reads = await prismaBase.noticeRead.count({ where: { noticeId: id } });

        return successResponse({ reads });
    } catch (error) {
        return errorResponse(error);
    }
});
