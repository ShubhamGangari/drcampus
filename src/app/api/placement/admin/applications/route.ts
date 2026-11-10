import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    errorResponse,
} from '@/lib/api';
import {
    tenantFilter,
    userHasPermission,
    requirePlacementView,
} from '@/lib/placement-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/placement/admin/applications?schoolId=&postId=
// Lists all placement applications for the school (staff view). Requires
// placement.manage OR placement.view. 200
// { applications: [{ id, studentId, studentName, postId, title, companyName,
//                    status }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const canManage = await userHasPermission(user, 'placement.manage');
        const canView = await userHasPermission(user, 'placement.view');
        if (!canManage && !canView) {
            throw requirePlacementView();
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const postId = url.searchParams.get('postId') ?? undefined;

        const applications = await withClient(user, async (db) => {
            const rows = await db.placementApplication.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    ...(postId ? { postId } : {}),
                },
                orderBy: { createdAt: 'desc' },
            });

            const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
            const students = studentIds.length
                ? await db.student.findMany({
                    where: { id: { in: studentIds } },
                    select: { id: true, firstName: true, lastName: true },
                })
                : [];
            const studentName = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));

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
                    studentId: r.studentId,
                    studentName: studentName.get(r.studentId) ?? 'Unknown student',
                    postId: r.postId,
                    title: post?.title ?? 'Unknown post',
                    companyName: post ? (companyName.get(post.companyId) ?? '') : '',
                    status: r.status,
                };
            });
        });

        return successResponse({ applications });
    } catch (error) {
        return errorResponse(error);
    }
});
