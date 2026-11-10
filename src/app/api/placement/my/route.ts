import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createApplicationSchema } from '@/lib/placement-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    findSelfStudent,
} from '@/lib/placement-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/placement/my?schoolId=
// Lists the current student's placement applications. 200
// { applications: [{ id, postId, title, companyName, status, appliedAt }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const applications = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const rows = await db.placementApplication.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    studentId: self.id,
                },
                orderBy: { createdAt: 'desc' },
            });

            const postIds = Array.from(new Set(rows.map((r) => r.postId)));
            const posts = postIds.length
                ? await db.placementPost.findMany({ where: { id: { in: postIds } } })
                : [];
            const companyIds = Array.from(new Set(posts.map((p) => p.companyId)));
            const companies = companyIds.length
                ? await db.placementCompany.findMany({
                    where: { id: { in: companyIds } },
                    select: { id: true, name: true },
                })
                : [];
            const companyName = new Map(companies.map((c) => [c.id, c.name]));

            return rows.map((r) => {
                const post = posts.find((p) => p.id === r.postId);
                return {
                    id: r.id,
                    postId: r.postId,
                    title: post?.title ?? 'Unknown post',
                    companyName: post ? (companyName.get(post.companyId) ?? '') : '',
                    status: r.status,
                    appliedAt: r.createdAt.toISOString(),
                };
            });
        });

        return successResponse({ applications });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/placement/my — self-service apply to a post. 201 { application }
// Dedupe guard → 409 DUPLICATE_APPLICATION.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createApplicationSchema);

        const application = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const tenant = resolveCreateTenant(user, body.schoolId);

            const post = await db.placementPost.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: body.postId },
            });
            if (!post) {
                throw new ApiError(404, 'POST_NOT_FOUND', 'Placement post not found');
            }

            const existing = await db.placementApplication.findFirst({
                where: { schoolId: tenant, postId: body.postId, studentId: self.id },
            });
            if (existing) {
                throw new ApiError(409, 'DUPLICATE_APPLICATION', 'You have already applied to this post');
            }

            const company = await db.placementCompany.findFirst({
                where: { id: post.companyId },
                select: { name: true },
            });

            const created = await db.placementApplication.create({
                data: {
                    schoolId: tenant,
                    postId: body.postId,
                    studentId: self.id,
                    status: 'APPLIED',
                },
            });

            return {
                id: created.id,
                postId: created.postId,
                title: post.title,
                companyName: company?.name ?? '',
                status: created.status,
                appliedAt: created.createdAt.toISOString(),
            };
        });

        return successResponse({ application }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
