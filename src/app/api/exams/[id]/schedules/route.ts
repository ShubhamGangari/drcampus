import { withClient } from '@/lib/prisma';
import {
  withAuth,
  successResponse,
  validateBody,
  errorResponse,
  ApiError,
} from '@/lib/api';
import { createScheduleSchema } from '@/lib/exam-schemas';
import { loadExam, assertCourseBelongsToSchool } from '@/lib/exam-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const EXAM_CONTROLLER_ROLE = 'EXAM_CONTROLLER';
const LIST_ROLES = ['EXAM_CONTROLLER', 'DEAN', 'REGISTRAR_ADMIN', 'STUDENT'];

// ---------------------------------------------------------------------------
// POST /api/exams/[id]/schedules — add a course schedule (EXAM_CONTROLLER).
//   201 { scheduleId } | 404 exam/course | 400 SCHOOL_MISMATCH | 409 duplicate
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, EXAM_CONTROLLER_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Exam controller access required');
    }

    const examId = params.id as string;
    const body = await validateBody(request, createScheduleSchema);

    return await withClient(user, async (db) => {
      const exam = await loadExam(db, examId);
      const tenant = exam.schoolId;

      await assertCourseBelongsToSchool(db, body.courseId, tenant);

      const duplicate = await db.examSchedule.findFirst({
        where: { examId, courseId: body.courseId },
        select: { id: true },
      });
      if (duplicate) {
        throw new ApiError(409, 'ALREADY_SCHEDULED', 'A schedule already exists for this course');
      }

      const schedule = await db.examSchedule.create({
        data: {
          schoolId: tenant,
          examId,
          courseId: body.courseId,
          examDate: new Date(body.examDate),
          startTime: body.startTime,
          venue: body.venue,
        },
        select: { id: true },
      });

      return successResponse({ scheduleId: schedule.id }, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/exams/[id]/schedules — list schedules.
//   200 [{ id, courseId, courseCode, courseTitle, examDate, startTime, venue }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user, params }) => {
  try {
    if (!LIST_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to schedules');
    }

    const examId = params.id as string;

    return await withClient(user, async (db) => {
      const exam = await loadExam(db, examId);

      // Students must not read schedules before the exam is published.
      if (user.role === 'STUDENT' && exam.status !== 'PUBLISHED') {
        throw new ApiError(
          403,
          'EXAM_NOT_PUBLISHED',
          'Exam schedules are not yet published'
        );
      }

      const schedules = await db.examSchedule.findMany({
        where: { examId },
        select: {
          id: true,
          courseId: true,
          examDate: true,
          startTime: true,
          venue: true,
        },
        orderBy: { examDate: 'asc' },
      });

      const courseIds = schedules.map((s) => s.courseId);
      const courses =
        courseIds.length > 0
          ? await db.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, code: true, title: true },
          })
          : [];
      const courseMap = new Map(courses.map((c) => [c.id, c]));

      return successResponse(
        schedules.map((s) => {
          const c = courseMap.get(s.courseId);
          return {
            id: s.id,
            courseId: s.courseId,
            courseCode: c?.code ?? null,
            courseTitle: c?.title ?? null,
            examDate: s.examDate,
            startTime: s.startTime,
            venue: s.venue,
          };
        })
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
});
