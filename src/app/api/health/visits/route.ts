import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createVisitSchema } from '@/lib/health-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    assertStudentBelongsToSchool,
    findSelfStudent,
    userHasPermission,
    requireHealthManage,
    validateVisitPayload,
} from '@/lib/health-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/health/visits?studentId=&status=&schoolId=
// Students see their own visits; health.view/manage users see the school's.
// 200 { visits: [{ id, studentId, studentName, date, type, symptoms, diagnosis,
// prescription, status }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const studentId = url.searchParams.get('studentId') ?? undefined;
        const status = url.searchParams.get('status') ?? undefined;

        const visits = await withClient(user, async (db) => {
            const canViewAll =
                (await userHasPermission(user, 'health.view')) ||
                (await userHasPermission(user, 'health.manage'));

            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            if (!canViewAll) {
                const self = await findSelfStudent(db, user);
                if (!self) {
                    throw new ApiError(400, 'STUDENT_REQUIRED', 'No student profile linked to this account');
                }
                where.studentId = self.id;
            } else if (studentId) {
                where.studentId = studentId;
            }
            if (status) {
                where.status = status;
            }

            const rows = await db.healthVisit.findMany({
                where,
                orderBy: { date: 'desc' },
            });

            const studentIds = rows.reduce<string[]>((acc, v) => {
                if (!acc.includes(v.studentId)) acc.push(v.studentId);
                return acc;
            }, []);
            const students = await db.student.findMany({
                where: { id: { in: studentIds } },
                select: { id: true, firstName: true, lastName: true },
            });
            const nameMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));

            return rows.map((v) => ({
                id: v.id,
                studentId: v.studentId,
                studentName: nameMap.get(v.studentId) ?? 'Unknown',
                date: v.date,
                type: v.type,
                symptoms: v.symptoms,
                diagnosis: v.diagnosis,
                prescription: v.prescription,
                status: v.status,
            }));
        });

        return successResponse({ visits });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/health/visits — log a visit (health.manage). 201 { visit }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'health.manage'))) {
            throw requireHealthManage();
        }

        const body = await validateBody(request, createVisitSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const check = validateVisitPayload(body);
        if (!check.valid) {
            throw new ApiError(400, 'VALIDATION_FAILED', check.error ?? 'Invalid visit payload');
        }

        const visit = await withClient(user, async (db) => {
            await assertStudentBelongsToSchool(db, body.studentId, tenant);

            return db.healthVisit.create({
                data: {
                    schoolId: tenant,
                    studentId: body.studentId,
                    date: body.date ? new Date(body.date) : undefined,
                    type: body.type,
                    symptoms: body.symptoms,
                    diagnosis: body.diagnosis ?? null,
                    prescription: body.prescription ?? null,
                    status: body.status ?? 'COMPLETED',
                    followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
                },
            });
        });

        return successResponse({ visit }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
