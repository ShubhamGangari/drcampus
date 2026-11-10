import { withClient } from '@/lib/prisma';
import {
  withAuth,
  successResponse,
  validateBody,
  errorResponse,
  ApiError,
} from '@/lib/api';
import { marksEntrySchema } from '@/lib/exam-schemas';
import {
  loadExam,
  loadScheduleForExam,
  computeTotalMarks,
  computeGradeForMarks,
} from '@/lib/exam-core';
import { assertStudentBelongsToSchool, findSelfStudent } from '@/lib/fee-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';


// ---------------------------------------------------------------------------
// POST /api/exams/[id]/marks — enter/update marks for a student+course
// (FACULTY, EXAM_CONTROLLER). 201 { marksId, totalMarks, grade }
//   403 marks locked (exam PUBLISHED) | 400 exceed maxInternal/maxExternal | 404
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, 'FACULTY', 'EXAM_CONTROLLER')) {
      throw new ApiError(403, 'FORBIDDEN', 'Faculty or exam controller access required');
    }

    const examId = params.id as string;
    const body = await validateBody(request, marksEntrySchema);

    return await withClient(user, async (db) => {
      const exam = await loadExam(db, examId);
      const tenant = exam.schoolId;

      if (exam.status === 'PUBLISHED') {
        throw new ApiError(403, 'MARKS_LOCKED', 'Marks are locked because the exam is published');
      }

      await assertStudentBelongsToSchool(db, body.studentId, tenant);
      await loadScheduleForExam(db, examId, body.scheduleId);

      if (body.internalMarks > exam.maxInternal) {
        throw new ApiError(400, 'MARKS_EXCEED_MAX', 'internalMarks exceeds maxInternal');
      }
      if (body.externalMarks > exam.maxExternal) {
        throw new ApiError(400, 'MARKS_EXCEED_MAX', 'externalMarks exceeds maxExternal');
      }

      const totalMarks = computeTotalMarks(body.internalMarks, body.externalMarks);
      const grade = computeGradeForMarks(totalMarks, exam.maxInternal, exam.maxExternal);

      const entry = await db.marksEntry.upsert({
        where: {
          schoolId_examId_scheduleId_studentId: {
            schoolId: tenant,
            examId,
            scheduleId: body.scheduleId,
            studentId: body.studentId,
          },
        },
        create: {
          schoolId: tenant,
          examId,
          scheduleId: body.scheduleId,
          studentId: body.studentId,
          internalMarks: body.internalMarks,
          externalMarks: body.externalMarks,
          totalMarks,
          grade,
          enteredBy: user.userId,
        },
        update: {
          internalMarks: body.internalMarks,
          externalMarks: body.externalMarks,
          totalMarks,
          grade,
          enteredBy: user.userId,
        },
        select: { id: true },
      });

      return successResponse({ marksId: entry.id, totalMarks, grade }, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/exams/[id]/marks — list marks.
//   Query: scheduleId?, studentId?
//   Roles: FACULTY, EXAM_CONTROLLER, DEAN (read); STUDENT sees own only.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, 'FACULTY', 'EXAM_CONTROLLER', 'DEAN', 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to marks');
    }

    const examId = params.id as string;
    const url = new URL(request.url);

    return await withClient(user, async (db) => {
      const exam = await loadExam(db, examId);
      const where: Record<string, unknown> = { examId, schoolId: exam.schoolId };

      const scheduleId = url.searchParams.get('scheduleId');
      const studentId = url.searchParams.get('studentId');
      if (scheduleId) where.scheduleId = scheduleId;

      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) {
          throw new ApiError(403, 'FORBIDDEN', 'No student record linked to this account');
        }
        where.studentId = self.id;
      } else if (studentId) {
        where.studentId = studentId;
      }

      const rows = await db.marksEntry.findMany({
        where,
        select: {
          id: true,
          studentId: true,
          scheduleId: true,
          internalMarks: true,
          externalMarks: true,
          totalMarks: true,
          grade: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return successResponse(
        rows.map((r) => ({ ...r, status: exam.status }))
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
});
