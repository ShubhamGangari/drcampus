import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { markAttendanceSchema } from '@/lib/attendance-schemas';
import { resolveCreateTenant, assertStudentBelongsToSchool } from '@/lib/attendance-core';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

const MARK_ROLES = ['FACULTY'];

// ---------------------------------------------------------------------------
// POST /api/attendance/mark — mark/update per-course attendance (FACULTY).
//   { schoolId?, courseId, date: YYYY-MM-DD, records: [{ studentId, status }] }
//   201 { marked: n } — upserts each record (duplicate date+course+student
//   updates the status, count unchanged).
// Errors: 400 invalid body / course-tenant mismatch / student-tenant mismatch;
//         404 course not found; 403 non-faculty; 400 central missing schoolId.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!MARK_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
    }

    const body = await validateBody(request, markAttendanceSchema);

    return await withClient(user, async (db) => {
      const tenant = resolveCreateTenant(user, body.schoolId);
      await assertCourseBelongsToSchool(db, body.courseId, tenant);

      // Validate every student belongs to the resolved tenant before writing.
      for (const rec of body.records) {
        await assertStudentBelongsToSchool(db, rec.studentId, tenant);
      }

      const date = new Date(body.date + 'T00:00:00.000Z');

      let marked = 0;
      await db.$transaction(async (tx) => {
        for (const rec of body.records) {
          const existing = await tx.attendanceRecord.findFirst({
            where: {
              schoolId: tenant,
              courseId: body.courseId,
              studentId: rec.studentId,
              date,
            },
          });

          if (existing) {
            await tx.attendanceRecord.update({
              where: { id: existing.id },
              data: { status: rec.status, markedById: user.userId },
            });
          } else {
            await tx.attendanceRecord.create({
              data: {
                schoolId: tenant,
                courseId: body.courseId,
                studentId: rec.studentId,
                date,
                status: rec.status,
                markedById: user.userId,
              },
            });
          }
          marked++;
        }
      });

      await writeAuditLog(db, {
        schoolId: tenant,
        actorId: user.userId,
        action: 'ATTENDANCE_MARKED',
        entityType: 'ATTENDANCE',
        entityId: body.courseId,
        summary: `Marked attendance for ${marked} student(s) on ${body.date}`,
      });

      return successResponse({ marked }, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
