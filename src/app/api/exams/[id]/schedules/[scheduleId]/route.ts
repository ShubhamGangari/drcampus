import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateScheduleSchema } from '@/lib/exam-schemas';
import { loadExam, loadScheduleForExam } from '@/lib/exam-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const EXAM_CONTROLLER_ROLE = 'EXAM_CONTROLLER';

// ---------------------------------------------------------------------------
// PUT /api/exams/[id]/schedules/[scheduleId] — edit a schedule (EXAM_CONTROLLER).
//   200 { scheduleId, courseId, examDate, startTime, venue }
// ---------------------------------------------------------------------------
export const PUT = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, EXAM_CONTROLLER_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Exam controller access required');
    }

    const examId = params.id as string;
    const scheduleId = params.scheduleId as string;
    const body = await validateBody(request, updateScheduleSchema);

    return await withClient(user, async (db) => {
      await loadExam(db, examId);
      await loadScheduleForExam(db, examId, scheduleId);

      const data: Record<string, unknown> = {};
      if (body.examDate !== undefined) data.examDate = new Date(body.examDate);
      if (body.startTime !== undefined) data.startTime = body.startTime;
      if (body.venue !== undefined) data.venue = body.venue;

      const updated = await db.examSchedule.update({
        where: { id: scheduleId },
        data,
        select: {
          id: true,
          courseId: true,
          examDate: true,
          startTime: true,
          venue: true,
        },
      });

      return successResponse(updated);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
