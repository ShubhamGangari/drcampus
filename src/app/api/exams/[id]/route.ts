import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { loadExam } from '@/lib/exam-core';

export const dynamic = 'force-dynamic';

const VIEW_ROLES = ['EXAM_CONTROLLER', 'DEAN', 'REGISTRAR_ADMIN', 'STUDENT'];

// ---------------------------------------------------------------------------
// GET /api/exams/[id] — exam detail + its schedules.
//   200 { id, ..., schedules: [{ id, courseId, courseCode, courseTitle,
//           examDate, startTime, venue }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user, params }) => {
  try {
    if (!VIEW_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this exam');
    }

    const examId = params.id as string;

    return await withClient(user, async (db) => {
      const exam = await loadExam(db, examId);

      // Students must not read draft/scheduled exam details before publication.
      if (user.role === 'STUDENT' && exam.status !== 'PUBLISHED') {
        throw new ApiError(
          403,
          'EXAM_NOT_PUBLISHED',
          'Exam details are not yet published'
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

      // Attach course code/title.
      const courseIds = schedules.map((s) => s.courseId);
      const courses =
        courseIds.length > 0
          ? await db.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, code: true, title: true },
          })
          : [];
      const courseMap = new Map(courses.map((c) => [c.id, c]));

      return successResponse({
        id: exam.id,
        programId: exam.programId,
        academicYear: exam.academicYear,
        semester: exam.semester,
        type: exam.type,
        title: exam.title,
        maxInternal: exam.maxInternal,
        maxExternal: exam.maxExternal,
        status: exam.status,
        publishedAt: exam.publishedAt,
        schedules: schedules.map((s) => {
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
        }),
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
});
