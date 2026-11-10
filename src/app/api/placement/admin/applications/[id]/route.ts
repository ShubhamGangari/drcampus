import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { updateApplicationStatusSchema } from '@/lib/placement-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    requirePlacementManage,
    canTransitionPlacementStatus,
} from '@/lib/placement-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/placement/admin/applications/[id] — update an application's status
// (placement.manage). Status transitions validated by
// canTransitionPlacementStatus. 200 { application }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'placement.manage'))) {
            throw requirePlacementManage();
        }

        const body = await validateBody(request, updateApplicationStatusSchema);
        const tenant = resolveCreateTenant(user, undefined);

        const application = await withClient(user, async (db) => {
            const existing = await db.placementApplication.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: params.id },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Application not found');
            }

            if (!canTransitionPlacementStatus(existing.status, body.status)) {
                throw new ApiError(400, 'INVALID_STATUS_TRANSITION', `Cannot transition from ${existing.status} to ${body.status}`);
            }

            const updated = await db.placementApplication.update({
                where: { id: params.id },
                data: { status: body.status },
            });

            const post = await db.placementPost.findFirst({
                where: { id: updated.postId },
            });
            const company = post
                ? await db.placementCompany.findFirst({ where: { id: post.companyId }, select: { name: true } })
                : null;
            const student = await db.student.findFirst({
                where: { id: updated.studentId },
                select: { firstName: true, lastName: true },
            });

            return {
                id: updated.id,
                studentId: updated.studentId,
                studentName: student ? `${student.firstName} ${student.lastName}`.trim() : 'Unknown student',
                postId: updated.postId,
                title: post?.title ?? 'Unknown post',
                companyName: company?.name ?? '',
                status: updated.status,
            };
        });

        return successResponse({ application });
    } catch (error) {
        return errorResponse(error);
    }
});
