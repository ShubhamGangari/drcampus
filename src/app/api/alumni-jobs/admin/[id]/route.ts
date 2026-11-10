import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { updateJobStatusSchema } from '@/lib/alumni-jobs-schemas';
import {
    tenantFilter,
    userHasPermission,
    requireAlumniJobsManage,
    canTransitionJobStatus,
} from '@/lib/alumni-jobs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/alumni-jobs/admin/[id]?schoolId= — update a job's moderation status
// (alumniJobs.manage). Transitions validated by canTransitionJobStatus.
// 200 { job }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'alumniJobs.manage'))) {
            throw requireAlumniJobsManage();
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const body = await validateBody(request, updateJobStatusSchema);

        const job = await withClient(user, async (db) => {
            const existing = await db.alumniJob.findFirst({
                where: { ...tenantFilter(isCentralUser(user), schoolId), id: params.id },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Job post not found');
            }

            if (!canTransitionJobStatus(existing.status, body.status)) {
                throw new ApiError(
                    400,
                    'INVALID_STATUS_TRANSITION',
                    `Cannot transition from ${existing.status} to ${body.status}`
                );
            }

            const updated = await db.alumniJob.update({
                where: { id: params.id },
                data: { status: body.status },
            });

            return {
                id: updated.id,
                title: updated.title,
                company: updated.company,
                location: updated.location,
                type: updated.type,
                postedByName: updated.postedByName,
                status: updated.status,
                createdAt: updated.createdAt.toISOString(),
            };
        });

        return successResponse({ job });
    } catch (error) {
        return errorResponse(error);
    }
});
