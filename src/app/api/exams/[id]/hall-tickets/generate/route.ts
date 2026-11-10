import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { generateHallTicketSchema } from '@/lib/exam-schemas';
import { loadExam, buildHallTicketNo, getNextSequence } from '@/lib/exam-core';
import { assertStudentBelongsToSchool } from '@/lib/fee-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const EXAM_CONTROLLER_ROLE = 'EXAM_CONTROLLER';
const MAX_SEQ_ATTEMPTS = 25;

// ---------------------------------------------------------------------------
// POST /api/exams/[id]/hall-tickets/generate — issue a hall ticket for a student
// (EXAM_CONTROLLER). 201 { hallTicketId, hallTicketNo }
//   404 student/exam | 400 SCHOOL_MISMATCH | 403 exam not scheduled | 409 duplicate
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, EXAM_CONTROLLER_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Exam controller access required');
    }

    const examId = params.id as string;
    const body = await validateBody(request, generateHallTicketSchema);

    return await withClient(user, async (db) => {
      const exam = await loadExam(db, examId);
      const tenant = exam.schoolId;

      const student = await assertStudentBelongsToSchool(db, body.studentId, tenant);

      // Hall tickets require the exam to have at least one schedule.
      const scheduleCount = await db.examSchedule.count({ where: { examId } });
      if (scheduleCount === 0) {
        throw new ApiError(403, 'NOT_SCHEDULED', 'Exam has no schedules yet');
      }

      // A student may only have one hall ticket per exam.
      const existing = await db.hallTicket.findFirst({
        where: { examId, studentId: student.id },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError(409, 'ALREADY_ISSUED', 'Hall ticket already issued for this student');
      }

      // Per-school sequence; hallTicketNo is globally unique so walk upward on collision.
      const year = new Date().getFullYear();
      const prefix = `HT-${year}-`;
      const seq0 = await getNextSequence(db, 'hallTicket', 'hallTicketNo', prefix, tenant);

      let ticket: { id: string; hallTicketNo: string } | null = null;
      for (let attempt = 0; attempt < MAX_SEQ_ATTEMPTS && !ticket; attempt++) {
        const hallTicketNo = buildHallTicketNo(seq0 + attempt, year);
        try {
          ticket = await db.hallTicket.create({
            data: { schoolId: tenant, examId, studentId: student.id, hallTicketNo },
            select: { id: true, hallTicketNo: true },
          });
        } catch (err) {
          const e = err as { code?: string };
          if (e.code === 'P2002') continue; // unique collision, try next seq
          throw err;
        }
      }

      if (!ticket) {
        throw new ApiError(409, 'HALL_TICKET_EXHAUSTED', 'Could not allocate a unique hall ticket number');
      }

      return successResponse({ hallTicketId: ticket.id, hallTicketNo: ticket.hallTicketNo }, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
