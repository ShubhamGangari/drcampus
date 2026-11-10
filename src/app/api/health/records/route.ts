import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { tenantFilter, userHasPermission, findSelfStudent } from '@/lib/health-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/health/records?studentId=&schoolId=
// Only the owning student or health.view/health.manage may read a record.
// A student's empty record is auto-created (lazy provision) on first read.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const studentIdParam = url.searchParams.get('studentId') ?? undefined;

        const records = await withClient(user, async (db) => {
            const canViewAll =
                (await userHasPermission(user, 'health.view')) ||
                (await userHasPermission(user, 'health.manage'));

            let targetStudentId: string | undefined = studentIdParam;
            if (!canViewAll) {
                // Non-health users may only ever read their own record. Asking for
                // someone else's record by id is forbidden.
                if (studentIdParam) {
                    throw new ApiError(403, 'FORBIDDEN', 'Health view permission required');
                }
                const self = await findSelfStudent(db, user);
                if (!self) {
                    throw new ApiError(400, 'STUDENT_REQUIRED', 'No student profile linked to this account');
                }
                targetStudentId = self.id;
            }

            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            if (targetStudentId) {
                where.studentId = targetStudentId;
            }

            let rows = await db.studentHealthRecord.findMany({ where });

            // Lazy provision: auto-create an empty record on first read.
            if (rows.length === 0 && targetStudentId) {
                const student = await db.student.findUnique({ where: { id: targetStudentId } });
                if (!student) {
                    throw new ApiError(404, 'NOT_FOUND', 'Student not found');
                }
                const created = await db.studentHealthRecord.upsert({
                    where: { studentId: targetStudentId },
                    create: { studentId: targetStudentId, schoolId: student.schoolId },
                    update: {},
                });
                rows = [created];
            }

            return rows.map((r) => ({
                studentId: r.studentId,
                bloodGroup: r.bloodGroup,
                allergies: r.allergies,
                chronicConditions: r.chronicConditions,
                emergencyContact: r.emergencyContact,
            }));
        });

        return successResponse({ records });
    } catch (error) {
        return errorResponse(error);
    }
});
