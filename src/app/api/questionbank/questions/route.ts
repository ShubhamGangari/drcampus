import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createQuestionSchema } from '@/lib/questionbank-schemas';
import {
    tenantFilter,
    resolveCreateTenant,
    userHasPermission,
    requireQuestionbankView,
    requireQuestionbankManage,
} from '@/lib/questionbank-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/questionbank/questions?courseId=&status=
// Lists questions. Admin/manage roles see all (optionally filtered); faculty see
// only their own authored questions. 200
// { questions: [{ id, courseId, courseCode, unit, type, difficulty, status,
//                 authorName }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const courseId = url.searchParams.get('courseId') ?? undefined;
        const status = url.searchParams.get('status') ?? undefined;

        const canView = await userHasPermission(user, 'questionbank.view');
        const canManage = await userHasPermission(user, 'questionbank.manage');
        const isFaculty = user.role === 'FACULTY';
        if (!canView && !canManage && !isFaculty) {
            throw requireQuestionbankView();
        }

        const questions = await withClient(user, async (db) => {
            const rows = await db.question.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    ...(courseId ? { courseId } : {}),
                    ...(status ? { status } : {}),
                    ...(isFaculty && !canManage ? { authorId: user.userId } : {}),
                },
                orderBy: { createdAt: 'desc' },
            });

            const courseIds = Array.from(new Set(rows.map((r) => r.courseId)));
            const courses = courseIds.length
                ? await db.course.findMany({
                    where: { id: { in: courseIds } },
                    select: { id: true, code: true },
                })
                : [];
            const courseMap = new Map(courses.map((c) => [c.id, c]));

            const authorIds = Array.from(new Set(rows.map((r) => r.authorId)));
            const authors = authorIds.length
                ? await db.user.findMany({
                    where: { id: { in: authorIds } },
                    select: { id: true, name: true },
                })
                : [];
            const authorMap = new Map(authors.map((a) => [a.id, a]));

            return rows.map((r) => ({
                id: r.id,
                courseId: r.courseId,
                courseCode: courseMap.get(r.courseId)?.code ?? null,
                unit: r.unit,
                type: r.type,
                difficulty: r.difficulty,
                status: r.status,
                authorName: authorMap.get(r.authorId)?.name ?? null,
            }));
        });

        return successResponse({ questions });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/questionbank/questions  (faculty: own course OR manage)
// Create a question. Faculty may author only for their allocated courses; manage
// roles may post to any course. 201 { question }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createQuestionSchema);

        const canManage = await userHasPermission(user, 'questionbank.manage');
        const isFaculty = user.role === 'FACULTY';
        if (!canManage && !isFaculty) {
            throw requireQuestionbankManage();
        }

        const question = await withClient(user, async (db) => {
            const tenant = resolveCreateTenant(user, body.schoolId);

            const course = await db.course.findUnique({
                where: { id: body.courseId },
                select: { id: true, schoolId: true },
            });
            if (!course) {
                throw new ApiError(404, 'NOT_FOUND', 'Course not found');
            }
            if (isCentralUser(user) && course.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Course does not belong to this school');
            }

            // Faculty may only author for their own allocated courses.
            if (isFaculty && !canManage) {
                const allocation = await db.facultyAllocation.findFirst({
                    where: { facultyUserId: user.userId, courseId: course.id },
                });
                if (!allocation) {
                    throw new ApiError(403, 'FORBIDDEN', 'You are not allocated to this course');
                }
            }

            return db.question.create({
                data: {
                    schoolId: tenant,
                    courseId: course.id,
                    unit: body.unit ?? null,
                    type: body.type,
                    difficulty: body.difficulty,
                    content: body.content,
                    status: 'DRAFT',
                    authorId: user.userId,
                },
            });
        });

        return successResponse({ question }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
