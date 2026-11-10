import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateAttendanceSchema } from '@/lib/attendance-schemas';
import { resolveCreateTenant, assertStudentBelongsToSchool } from '@/lib/attendance-core';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

const UPDATE_ROLES = ['FACULTY', 'SUPER_ADMIN'];

// ---------------------------------------------------------------------------
// POST /api/attendance/update — flip a single student's status for a course+date
//   (FACULTY). Drill-down edit: used by the per-student day view.
//   { schoolId?, courseId, studentId, date: YYYY-MM-DD, status }
//   200 { updated: true, record: { date, status, markedById, teacherName } }
// Errors: 400 invalid body / tenant mismatch; 404 record not found;
//         403 non-faculty; 400 central missing schoolId.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!UPDATE_ROLES.includes(user.role)) {
            throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
        }

        const body = await validateBody(request, updateAttendanceSchema);

        return await withClient(user, async (db) => {
            const tenant = resolveCreateTenant(user, body.schoolId);
            await assertCourseBelongsToSchool(db, body.courseId, tenant);
            await assertStudentBelongsToSchool(db, body.studentId, tenant);

            const date = new Date(body.date + 'T00:00:00.000Z');

            const existing = await db.attendanceRecord.findFirst({
                where: {
                    schoolId: tenant,
                    courseId: body.courseId,
                    studentId: body.studentId,
                    date,
                },
            });

            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'No attendance record for this student on that date');
            }

            const updated = await db.attendanceRecord.update({
                where: { id: existing.id },
                data: { status: body.status, markedById: user.userId },
            });

            const marker = await db.user.findUnique({
                where: { id: user.userId },
                select: { name: true },
            });

            await writeAuditLog(db, {
                schoolId: tenant,
                actorId: user.userId,
                action: 'ATTENDANCE_UPDATED',
                entityType: 'ATTENDANCE',
                entityId: updated.id,
                summary: `Updated attendance to ${body.status} for ${body.studentId} on ${body.date}`,
            });

            return successResponse({
                updated: true,
                record: {
                    date: updated.date.toISOString().slice(0, 10),
                    status: updated.status,
                    markedById: user.userId,
                    teacherName: marker?.name ?? null,
                },
            });
        });
    } catch (error) {
        return errorResponse(error);
    }
});
