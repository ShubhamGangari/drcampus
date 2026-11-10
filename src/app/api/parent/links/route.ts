import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, validateBody, ApiError } from '@/lib/api';
import { createLinkSchema } from '@/lib/parent-schemas';
import {
    tenantFilter,
    userHasPermission,
    requireParentManage,
    loadLinks,
    assertParentUserBelongsToSchool,
    resolveCreateTenant,
    assertStudentBelongsToSchool,
} from '@/lib/parent-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/parent/links?schoolId=&parentUserId=&studentId=
// Admin list of ParentStudentLink rows (management view). Requires `parent.manage`.
// 200 { links: [{ id, parentUserId, parentName, studentId, studentName }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const canManage = await userHasPermission(user, 'parent.manage');
        if (!canManage) throw requireParentManage();

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const parentUserId = url.searchParams.get('parentUserId') ?? undefined;
        const studentId = url.searchParams.get('studentId') ?? undefined;

        const links = await withClient(user, async (db) => {
            const tenant = tenantFilter(isCentralUser(user), schoolId);
            return loadLinks(db, tenant, { parentUserId, studentId });
        });

        return successResponse({ links });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/parent/links
// Creates a ParentStudentLink (admin). Requires `parent.manage`.
// Body { schoolId?, parentUserId, studentId }.
// - Validates parent + student exist in the same school (404 / 400).
// - Duplicate (schoolId, parentUserId, studentId) pair -> 409.
// 201 { link: { id, parentUserId, parentName, studentId, studentName } }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const canManage = await userHasPermission(user, 'parent.manage');
        if (!canManage) throw requireParentManage();

        const body = await validateBody(request, createLinkSchema);

        const result = await withClient(user, async (db) => {
            const schoolId = resolveCreateTenant(user, body.schoolId);

            const [parent, student] = await Promise.all([
                assertParentUserBelongsToSchool(db, body.parentUserId, schoolId),
                assertStudentBelongsToSchool(db, body.studentId, schoolId),
            ]);

            const existing = await db.parentStudentLink.findFirst({
                where: { schoolId, parentUserId: body.parentUserId, studentId: body.studentId },
                select: { id: true },
            });
            if (existing) {
                throw new ApiError(409, 'CONFLICT', 'This student is already linked to this parent');
            }

            const link = await db.parentStudentLink.create({
                data: { schoolId, parentUserId: body.parentUserId, studentId: body.studentId },
                select: { id: true, parentUserId: true, studentId: true },
            });

            return {
                link: {
                    ...link,
                    parentName: parent.name,
                    studentName: `${student.firstName} ${student.lastName}`.trim(),
                },
            };
        });

        return successResponse(result, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
