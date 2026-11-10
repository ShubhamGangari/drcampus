import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    errorResponse,
} from '@/lib/api';
import {
    tenantFilter,
    findSelfStudent,
} from '@/lib/alumni-jobs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/alumni-jobs/my?schoolId=
// Returns the current user's personal board data: jobs they posted (alumni)
// and jobs they applied to (students). 200
// { jobs: [{ id, title, company, location, type, postedByName, status, createdAt }],
//   applications: [{ id, jobId, title, company, status, appliedAt }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const data = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);

            const jobs = await db.alumniJob.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    postedBy: user.userId,
                },
                orderBy: { createdAt: 'desc' },
            });

            let applications: Array<{
                id: string;
                jobId: string;
                title: string;
                company: string;
                status: string;
                appliedAt: string;
            }> = [];

            if (self) {
                const appRows = await db.alumniJobApplication.findMany({
                    where: {
                        ...tenantFilter(isCentralUser(user), schoolId),
                        studentId: self.id,
                    },
                    orderBy: { createdAt: 'desc' },
                });

                const jobIds = Array.from(new Set(appRows.map((a) => a.jobId)));
                const jobRows = jobIds.length
                    ? await db.alumniJob.findMany({ where: { id: { in: jobIds } } })
                    : [];
                const jobMap = new Map(jobRows.map((j) => [j.id, j]));

                applications = appRows.map((a) => {
                    const job = jobMap.get(a.jobId);
                    return {
                        id: a.id,
                        jobId: a.jobId,
                        title: job?.title ?? 'Unknown job',
                        company: job?.company ?? '',
                        status: a.status,
                        appliedAt: a.createdAt.toISOString(),
                    };
                });
            }

            return {
                jobs: jobs.map((r) => ({
                    id: r.id,
                    title: r.title,
                    company: r.company,
                    location: r.location,
                    type: r.type,
                    postedByName: r.postedByName,
                    status: r.status,
                    createdAt: r.createdAt.toISOString(),
                })),
                applications,
            };
        });

        return successResponse(data);
    } catch (error) {
        return errorResponse(error);
    }
});
