import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createNoticeSchema } from '@/lib/notices-schemas';
import {
    tenantFilter,
    userHasPermission,
    requireNoticesManage,
    isNoticeVisible,
    matchesAudience,
} from '@/lib/notices-core';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/notices?schoolId= — audience-filtered notice board (auth, any user).
// Returns notices the caller is allowed to see: visible within their window AND
// matching the caller's (schoolId, role). Pinned notices sort first.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const rows = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            const found = await db.notice.findMany({
                where,
                orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
            });
            const now = new Date();
            return found.filter(
                (n) =>
                    isNoticeVisible(n.publishedAt, n.expiresAt, now) &&
                    matchesAudience(n.audienceJson, {
                        schoolId: user.schoolId,
                        role: user.role,
                    })
            );
        });

        return successResponse({ notices: rows });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/notices — publish a notice (notices.manage). 201 { notice }.
// Body: { title, category, body, audience?, pinned?, expiresAt? }.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'notices.manage'))) {
            throw requireNoticesManage();
        }

        const body = await validateBody(request, createNoticeSchema);

        // Central officers must pick a target tenant; school-scoped users rely on
        // the extended client to inject their schoolId.
        if (isCentralUser(user) && !body.schoolId) {
            throw new ApiError(400, 'BAD_REQUEST', 'schoolId is required for central officers');
        }

        const notice = await withClient(user, async (db) => {
            const data = {
                title: body.title,
                category: body.category,
                body: body.body,
                audienceJson: JSON.stringify(body.audience ?? {}),
                pinned: body.pinned ?? false,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            };

            const targetSchoolId = isCentralUser(user) ? (body.schoolId as string) : user.schoolId;
            const created = await db.notice.create({ data: { ...data, schoolId: targetSchoolId } });

            await writeAuditLog(db, {
                schoolId: created.schoolId,
                actorId: user.userId,
                action: 'NOTICE_PUBLISH',
                entityType: 'Notice',
                entityId: created.id,
                summary: `Published notice "${created.title}"`,
            });

            return created;

            await writeAuditLog(db, {
                schoolId: created.schoolId,
                actorId: user.userId,
                action: 'NOTICE_PUBLISH',
                entityType: 'Notice',
                entityId: created.id,
                summary: `Published notice "${created.title}"`,
            });

            return created;
        });

        return successResponse({ notice }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
