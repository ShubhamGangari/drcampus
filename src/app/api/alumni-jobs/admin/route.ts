import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    errorResponse,
} from '@/lib/api';
import {
    tenantFilter,
    userHasPermission,
    requireAlumniJobsManage,
} from '@/lib/alumni-jobs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/alumni-jobs/admin?schoolId=
// Lists all job posts with application counts (moderation view). Requires
// alumniJobs.manage. 200
// { jobs: [{ id, title, company, postedByName, status, appliedCount }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'alumniJobs.manage'))) {
            throw requireAlumniJobsManage();
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const jobs = await withClient(user, async (db) => {
            const rows = await db.alumniJob.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { createdAt: 'desc' },
            });

            const result = [];
            for (const r of rows) {
                const appliedCount = await db.alumniJobApplication.count({
                    where: { jobId: r.id },
                });
                result.push({
                    id: r.id,
                    title: r.title,
                    company: r.company,
                    postedByName: r.postedByName,
                    status: r.status,
                    appliedCount,
                });
            }
            return result;
        });

        return successResponse({ jobs });
    } catch (error) {
        return errorResponse(error);
    }
});
