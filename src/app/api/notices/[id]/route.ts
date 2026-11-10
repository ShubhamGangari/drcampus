import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateNoticeSchema } from '@/lib/notices-schemas';
import { userHasPermission, requireNoticesManage } from '@/lib/notices-core';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/notices/[id] — edit a notice (notices.manage). 200 { notice }.
// Body: { title?, category?, body?, pinned?, expiresAt? }.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'notices.manage'))) {
            throw requireNoticesManage();
        }

        const body = await validateBody(request, updateNoticeSchema);
        const id = params.id;

        const notice = await withClient(user, async (db) => {
            const existing = await db.notice.findUnique({ where: { id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Notice not found');
            }

            const data: {
                title?: string;
                category?: string;
                body?: string;
                pinned?: boolean;
                expiresAt?: Date | null;
            } = {};
            if (body.title !== undefined) data.title = body.title;
            if (body.category !== undefined) data.category = body.category;
            if (body.body !== undefined) data.body = body.body;
            if (body.pinned !== undefined) data.pinned = body.pinned;
            if (body.expiresAt !== undefined) {
                data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
            }

            const updated = await db.notice.update({ where: { id }, data });

            await writeAuditLog(db, {
                schoolId: updated.schoolId,
                actorId: user.userId,
                action: 'NOTICE_UPDATE',
                entityType: 'Notice',
                entityId: updated.id,
                summary: `Updated notice "${updated.title}"`,
            });

            return updated;
        });

        return successResponse({ notice });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/notices/[id] — remove a notice (notices.manage). 200 { success }.
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'notices.manage'))) {
            throw requireNoticesManage();
        }

        const id = params.id;

        const result = await withClient(user, async (db) => {
            const existing = await db.notice.findUnique({ where: { id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Notice not found');
            }

            await db.notice.delete({ where: { id } });

            await writeAuditLog(db, {
                schoolId: existing.schoolId,
                actorId: user.userId,
                action: 'NOTICE_DELETE',
                entityType: 'Notice',
                entityId: existing.id,
                summary: `Deleted notice "${existing.title}"`,
            });

            return true;
        });

        return successResponse({ success: result });
    } catch (error) {
        return errorResponse(error);
    }
});
