import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { loadExam } from '@/lib/exam-core';
import { findSelfStudent } from '@/lib/fee-core';

export const dynamic = 'force-dynamic';

const EXAM_CONTROLLER_ROLE = 'EXAM_CONTROLLER';

// ---------------------------------------------------------------------------
// GET /api/exams/[id]/hall-tickets — list tickets.
//   EXAM_CONTROLLER: all tickets for the exam; STUDENT: own ticket only.
//   200 [{ id, studentId, hallTicketNo, createdAt }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user, params }) => {
  try {
    const examId = params.id as string;

    return await withClient(user, async (db) => {
      await loadExam(db, examId);

      const where: Record<string, unknown> = { examId };

      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) {
          throw new ApiError(403, 'FORBIDDEN', 'No student record linked to this account');
        }
        where.studentId = self.id;
      } else if (user.role === EXAM_CONTROLLER_ROLE) {
        // all tickets for the exam
      } else {
        throw new ApiError(403, 'FORBIDDEN', 'You do not have access to hall tickets');
      }

      const tickets = await db.hallTicket.findMany({
        where,
        select: { id: true, studentId: true, hallTicketNo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      return successResponse(tickets);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
