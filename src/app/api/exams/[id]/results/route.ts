import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { loadExam, computeResultTotals } from '@/lib/exam-core';
import { findSelfStudent } from '@/lib/fee-core';

export const dynamic = 'force-dynamic';

const VIEW_ROLES = ['EXAM_CONTROLLER', 'DEAN', 'REGISTRAR_ADMIN', 'STUDENT'];

// ---------------------------------------------------------------------------
// GET /api/exams/[id]/results — per-exam result list.
//   200 [{ studentId, rollNo, name, totalSecured, totalMax, percentage, grade,
//          status }]  (STUDENT sees own only)
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user, params }) => {
  try {
    if (!VIEW_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to results');
    }

    const examId = params.id as string;

    return await withClient(user, async (db) => {
      const exam = await loadExam(db, examId);
      const tenant = exam.schoolId;

      // Publication gate (spec §6.6): students / dean / registrar may only view
      // results after the exam is published. EXAM_CONTROLLER always has access.
      if (
        (user.role === 'STUDENT' ||
          user.role === 'DEAN' ||
          user.role === 'REGISTRAR_ADMIN') &&
        exam.status !== 'PUBLISHED'
      ) {
        throw new ApiError(
          403,
          'RESULTS_NOT_PUBLISHED',
          'Results are not yet published'
        );
      }

      const where: Record<string, unknown> = { examId, schoolId: tenant };
      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) {
          throw new ApiError(403, 'FORBIDDEN', 'No student record linked to this account');
        }
        where.studentId = self.id;
      }

      const entries = await db.marksEntry.findMany({
        where,
        select: { studentId: true, totalMarks: true },
      });

      // Aggregate per student across their schedules.
      const perStudent = new Map<string, { totalSecured: number; count: number }>();
      const studentOrder: string[] = [];
      for (const e of entries) {
        const cur = perStudent.get(e.studentId) ?? { totalSecured: 0, count: 0 };
        if (!perStudent.has(e.studentId)) studentOrder.push(e.studentId);
        cur.totalSecured += Number(e.totalMarks) || 0;
        cur.count += 1;
        perStudent.set(e.studentId, cur);
      }

      const students =
        studentOrder.length > 0
          ? await db.student.findMany({
            where: { id: { in: studentOrder } },
            select: { id: true, rollNo: true, firstName: true, lastName: true },
          })
          : [];
      const studentMap = new Map(students.map((s) => [s.id, s]));

      const maxPerSchedule =
        (Number(exam.maxInternal) || 0) + (Number(exam.maxExternal) || 0);

      const rows: Array<{
        studentId: string;
        rollNo: string | null;
        name: string | null;
        totalSecured: number;
        totalMax: number;
        percentage: number | null;
        grade: string;
        status: string;
      }> = [];
      perStudent.forEach((agg, studentId) => {
        const totals = computeResultTotals({
          totalSecured: agg.totalSecured,
          totalMax: agg.count * maxPerSchedule,
        });
        const s = studentMap.get(studentId);
        rows.push({
          studentId,
          rollNo: s?.rollNo ?? null,
          name:
            s && (s.firstName || s.lastName)
              ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
              : null,
          totalSecured: totals.totalSecured,
          totalMax: totals.totalMax,
          percentage: totals.percentage,
          grade: totals.grade,
          status: exam.status,
        });
      });

      rows.sort((a, b) => (a.rollNo ?? '').localeCompare(b.rollNo ?? ''));
      return successResponse(rows);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
