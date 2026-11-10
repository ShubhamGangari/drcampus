import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
} from '@/lib/api';
import { createJobSchema } from '@/lib/alumni-jobs-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    requireAlumniJobsPost,
    findSelfAlumnus,
    findSelfStudent,
} from '@/lib/alumni-jobs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/alumni-jobs?schoolId=
// Lists the approved job posts on the public alumni board. 200
// { jobs: [{ id, title, company, location, type, postedByName, status, createdAt }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const jobs = await withClient(user, async (db) => {
            const rows = await db.alumniJob.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    status: 'APPROVED',
                },
                orderBy: { createdAt: 'desc' },
            });

            return rows.map((r) => ({
                id: r.id,
                title: r.title,
                company: r.company,
                location: r.location,
                type: r.type,
                postedByName: r.postedByName,
                status: r.status,
                createdAt: r.createdAt.toISOString(),
            }));
        });

        return successResponse({ jobs });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/alumni-jobs — post a new job (alumniJobs.post OR alumni profile OR
// admin). New posts default to PENDING; only moderators approve them. 201 { job }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createJobSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const job = await withClient(user, async (db) => {
            const allowedByPerm = await userHasPermission(user, 'alumniJobs.post');
            const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'REGISTRAR_ADMIN';
            if (!allowedByPerm && !isAdmin) {
                const alumnus = await findSelfAlumnus(db, user);
                if (!alumnus) {
                    throw requireAlumniJobsPost();
                }
            }

            const creator = await db.user.findUnique({
                where: { id: user.userId },
                select: { name: true },
            });
            const self = await findSelfStudent(db, user);
            const selfName = self ? `${self.firstName} ${self.lastName}`.trim() : null;
            const postedByName = creator?.name ?? selfName ?? 'Alumni';

            const created = await db.alumniJob.create({
                data: {
                    schoolId: tenant,
                    title: body.title,
                    company: body.company,
                    location: body.location ?? null,
                    type: body.type,
                    description: body.description,
                    contact: body.contact,
                    postedBy: user.userId,
                    postedByName,
                    status: 'PENDING',
                },
            });

            return {
                id: created.id,
                title: created.title,
                company: created.company,
                location: created.location,
                type: created.type,
                postedByName: created.postedByName,
                status: created.status,
                createdAt: created.createdAt.toISOString(),
            };
        });

        return successResponse({ job }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
