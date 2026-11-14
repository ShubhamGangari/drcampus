import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { notifyDefaultersSchema, NotifyDefaultersInput } from '@/lib/attendance-schemas';
import { resolveCreateTenant, buildAttendanceRows } from '@/lib/attendance-core';
import { assertCourseBelongsToSchool } from '@/lib/exam-core';

export const dynamic = 'force-dynamic';

const NOTIFY_ROLES = ['FACULTY', 'REGISTRAR_ADMIN', 'SUPER_ADMIN'];

const NOTIFICATION_TYPE = 'attendance_defaulter';
const NOTIFICATION_TITLE = 'Attendance below threshold';

// ---------------------------------------------------------------------------
// POST /api/attendance/notify-defaulters (FACULTY, REGISTRAR_ADMIN, SUPER_ADMIN)
//   Body: { courseId, threshold, schoolId?, message? }
//   201 { notified: number }
//
// Computes defaulters (students below `threshold`%), then creates an in-app
// `Notification` (type "attendance_defaulter", link "/attendance/report?courseId=…")
// for each defaulter's user account (resolved via the Student→User email link).
// Students without a user account are skipped. Idempotent per (course, student):
// re-sending updates the existing notification's body/createdAt instead of
// duplicating.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!NOTIFY_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to notify defaulters');
    }

    const body = await validateBody<NotifyDefaultersInput>(request, notifyDefaultersSchema);

    return await withClient(user, async (db) => {
      const tenant = resolveCreateTenant(user, body.schoolId);
      const course = await assertCourseBelongsToSchool(db, body.courseId, tenant);

      const records = await db.attendanceRecord.findMany({
        where: { courseId: body.courseId, schoolId: tenant },
        select: { studentId: true, status: true },
      });

      const rows = await buildAttendanceRows(db, records);
      const defaulters = rows.filter(
        (r) => r.percentage !== null && r.percentage < body.threshold
      );
      if (defaulters.length === 0) {
        return successResponse({ notified: 0 }, 201);
      }

      // Load student emails so we can resolve each defaulter's user account via
      // the Student→User email link (same link findSelfStudent uses).
      const studentIds = defaulters.map((r) => r.studentId);
      const students = await db.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, email: true },
      });
      const studentsByEmail = new Map(students.map((s) => [s.id, s.email]));

      const emails = Array.from(studentsByEmail.values()).filter(Boolean);
      const users = emails.length
        ? await db.user.findMany({
            where: { email: { in: emails } },
            select: { id: true, email: true },
          })
        : [];
      const userByEmail = new Map(users.map((u) => [u.email, u.id]));

      const link = `/attendance/report?courseId=${body.courseId}`;

      let notified = 0;
      await db.$transaction(async (tx) => {
        for (const d of defaulters) {
          const email = studentsByEmail.get(d.studentId);
          if (!email) continue;
          const recipientUserId = userByEmail.get(email);
          if (!recipientUserId) continue; // skip students with no user account

          const bodyText =
            body.message ??
            `Your attendance in ${course.title} is ${d.percentage}% (below ${body.threshold}%)`;

          // Idempotent: find an existing defaulter notification for this
          // recipient+course; update it (fresh timestamp) instead of duplicating.
          const existing = await tx.notification.findFirst({
            where: {
              recipientUserId,
              type: NOTIFICATION_TYPE,
              link: { contains: body.courseId },
            },
            select: { id: true },
          });

          if (existing) {
            await tx.notification.update({
              where: { id: existing.id },
              data: {
                title: NOTIFICATION_TITLE,
                body: bodyText,
                link,
                read: false,
                createdAt: new Date(),
              },
            });
          } else {
            await tx.notification.create({
              data: {
                schoolId: tenant,
                recipientUserId,
                type: NOTIFICATION_TYPE,
                title: NOTIFICATION_TITLE,
                body: bodyText,
                link,
              },
            });
          }
          notified++;
        }
      });

      return successResponse({ notified }, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
