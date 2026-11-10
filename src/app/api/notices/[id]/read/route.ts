import { withClient, prismaBase } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/notices/[id]/read — record a read receipt for the current user.
// A receipt is unique per (notice, user): repeat reads are idempotent. The
// notice itself is resolved through the tenant-scoped client so a user can only
// mark a notice in their own scope as read. NoticeRead has no schoolId column,
// so it is written via the base client keyed by noticeId + userId.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
    try {
        const id = params.id;

        await withClient(user, async (db) => {
            const existing = await db.notice.findUnique({ where: { id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Notice not found');
            }
        });

        await prismaBase.noticeRead.upsert({
            where: {
                noticeId_userId: { noticeId: id, userId: user.userId },
            },
            create: { noticeId: id, userId: user.userId },
            update: {},
        });

        return successResponse({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
});
