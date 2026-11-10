import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createDutySchema } from '@/lib/questionbank-schemas';
import {
    tenantFilter,
    resolveCreateTenant,
    userHasPermission,
    requireQuestionbankView,
    requireQuestionbankManage,
} from '@/lib/questionbank-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/questionbank/duty?facultyUserId=
// Lists exam duty assignments. Faculty see their own schedule; admin/manage see
// all (optionally filtered by facultyUserId). 200
// { duty: [{ id, facultyUserId, facultyName, examId, date, venue, role }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const facultyUserId = url.searchParams.get('facultyUserId') ?? undefined;

        const canView = await userHasPermission(user, 'questionbank.view');
        const canManage = await userHasPermission(user, 'questionbank.manage');
        const isFaculty = user.role === 'FACULTY';
        if (!canView && !canManage && !isFaculty) {
            throw requireQuestionbankView();
        }

        const duty = await withClient(user, async (db) => {
            const resolvedFaculty = isFaculty && !canManage ? user.userId : facultyUserId;

            const rows = await db.examDuty.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    ...(resolvedFaculty ? { facultyUserId: resolvedFaculty } : {}),
                },
                orderBy: { date: 'asc' },
            });

            const facultyIds = Array.from(new Set(rows.map((r) => r.facultyUserId)));
            const faculties = facultyIds.length
                ? await db.user.findMany({
                    where: { id: { in: facultyIds } },
                    select: { id: true, name: true },
                })
                : [];
            const facultyMap = new Map(faculties.map((f) => [f.id, f]));

            return rows.map((r) => ({
                id: r.id,
                facultyUserId: r.facultyUserId,
                facultyName: facultyMap.get(r.facultyUserId)?.name ?? null,
                examId: r.examId,
                date: r.date,
                venue: r.venue,
                role: r.role,
            }));
        });

        return successResponse({ duty });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/questionbank/duty  (manage — questionbank.manage)
// Assign a faculty member to exam duty. Must reference an existing exam and must
// not duplicate an existing (exam, faculty) assignment (409 DUPLICATE_DUTY).
// 201 { duty }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createDutySchema);

        if (!(await userHasPermission(user, 'questionbank.manage'))) {
            throw requireQuestionbankManage();
        }

        const duty = await withClient(user, async (db) => {
            const tenant = resolveCreateTenant(user, body.schoolId);

            // Duty must reference an existing exam (Exam or SupplementaryExam).
            const exam = await db.exam.findUnique({
                where: { id: body.examId },
                select: { id: true },
            });
            const suppExam = exam
                ? null
                : await db.supplementaryExam.findUnique({
                    where: { id: body.examId },
                    select: { id: true },
                });
            if (!exam && !suppExam) {
                throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
            }

            // Faculty must exist and belong to the target tenant.
            const faculty = await db.user.findUnique({
                where: { id: body.facultyUserId },
                select: { id: true, schoolId: true },
            });
            if (!faculty) {
                throw new ApiError(404, 'NOT_FOUND', 'Faculty member not found');
            }
            if (isCentralUser(user) && faculty.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Faculty does not belong to this school');
            }

            const existing = await db.examDuty.findFirst({
                where: { examId: body.examId, facultyUserId: body.facultyUserId },
            });
            if (existing) {
                throw new ApiError(409, 'DUPLICATE_DUTY', 'Faculty is already assigned to this exam');
            }

            return db.examDuty.create({
                data: {
                    schoolId: tenant,
                    examId: body.examId,
                    facultyUserId: body.facultyUserId,
                    date: new Date(body.date),
                    venue: body.venue ?? null,
                    role: body.role ?? 'INVIGILATOR',
                },
            });
        });

        return successResponse({ duty }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
