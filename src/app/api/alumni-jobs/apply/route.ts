import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { applyJobSchema } from '@/lib/alumni-jobs-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    findSelfStudent,
    requireStudentApplication,
} from '@/lib/alumni-jobs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/alumni-jobs/apply — a student applies to a job post. 201 { application }
// Dedupe guard → 409 DUPLICATE_APPLICATION.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, applyJobSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const application = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw requireStudentApplication();
            }

            const job = await db.alumniJob.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: body.jobId },
            });
            if (!job) {
                throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
            }

            const existing = await db.alumniJobApplication.findFirst({
                where: { schoolId: tenant, jobId: body.jobId, studentId: self.id },
            });
            if (existing) {
                throw new ApiError(409, 'DUPLICATE_APPLICATION', 'You have already applied to this job');
            }

            const created = await db.alumniJobApplication.create({
                data: {
                    schoolId: tenant,
                    jobId: body.jobId,
                    studentId: self.id,
                    status: 'APPLIED',
                },
            });

            return {
                id: created.id,
                jobId: created.jobId,
                title: job.title,
                company: job.company,
                status: created.status,
                appliedAt: created.createdAt.toISOString(),
            };
        });

        return successResponse({ application }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
