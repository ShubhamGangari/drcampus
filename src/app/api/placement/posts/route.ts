import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createPostSchema } from '@/lib/placement-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    requirePlacementManage,
} from '@/lib/placement-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/placement/posts?schoolId=
// Lists placement posts with company name. Read-only, self-service. 200
// { posts: [{ id, title, companyName, package, deadline, eligibility }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const posts = await withClient(user, async (db) => {
            const rows = await db.placementPost.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { createdAt: 'desc' },
            });

            const companyIds = Array.from(new Set(rows.map((p) => p.companyId)));
            const companies = companyIds.length
                ? await db.placementCompany.findMany({
                    where: { id: { in: companyIds } },
                    select: { id: true, name: true },
                })
                : [];
            const companyName = new Map(companies.map((c) => [c.id, c.name]));

            return rows.map((p) => ({
                id: p.id,
                title: p.title,
                companyId: p.companyId,
                companyName: companyName.get(p.companyId) ?? '',
                package: p.package,
                deadline: p.deadline ? p.deadline.toISOString() : null,
                eligibility: p.eligibility,
            }));
        });

        return successResponse({ posts });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/placement/posts — create a placement post (placement.manage). 201 { post }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'placement.manage'))) {
            throw requirePlacementManage();
        }

        const body = await validateBody(request, createPostSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const post = await withClient(user, async (db) => {
            const company = await db.placementCompany.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: body.companyId },
                select: { id: true, name: true },
            });
            if (!company) {
                throw new ApiError(404, 'COMPANY_NOT_FOUND', 'Company not found');
            }
            if (body.driveId) {
                const drive = await db.placementDrive.findFirst({
                    where: { ...tenantFilter(isCentralUser(user), tenant), id: body.driveId },
                    select: { id: true },
                });
                if (!drive) {
                    throw new ApiError(404, 'DRIVE_NOT_FOUND', 'Drive not found');
                }
            }

            const created = await db.placementPost.create({
                data: {
                    schoolId: tenant,
                    companyId: body.companyId,
                    driveId: body.driveId ?? null,
                    title: body.title,
                    package: body.package ?? null,
                    deadline: body.deadline ? new Date(body.deadline) : null,
                    eligibility: body.eligibility ?? null,
                },
            });

            return {
                id: created.id,
                title: created.title,
                companyId: created.companyId,
                companyName: company.name,
                package: created.package,
                deadline: created.deadline ? created.deadline.toISOString() : null,
                eligibility: created.eligibility,
            };
        });

        return successResponse({ post }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
