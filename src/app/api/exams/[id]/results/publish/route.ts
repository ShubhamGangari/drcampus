import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { loadExam } from '@/lib/exam-core';
import { writeAuditLog } from '@/lib/audit-writer';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const EXAM_CONTROLLER_ROLE = 'EXAM_CONTROLLER';

// ---------------------------------------------------------------------------
// POST /api/exams/[id]/results/publish — publish results (EXAM_CONTROLLER).
//   200 { published: true, publishedAt } | 409 already published
// Publishing locks further marks entry (marks POST rejects once PUBLISHED).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, EXAM_CONTROLLER_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Exam controller access required');
    }

    const examId = params.id as string;

    return await withClient(user, async (db) => {
      const exam = await loadExam(db, examId);

      if (exam.status === 'PUBLISHED') {
        throw new ApiError(409, 'ALREADY_PUBLISHED', 'Exam results are already published');
      }

      const publishedAt = new Date();
      await db.exam.update({
        where: { id: examId },
        data: { status: 'PUBLISHED', publishedAt },
      });

      await writeAuditLog(db, {
        schoolId: exam.schoolId,
        actorId: user.userId,
        action: 'EXAM_PUBLISHED',
        entityType: 'EXAM',
        entityId: examId,
        summary: `Published results for exam ${examId}`,
      });

      return successResponse({ published: true, publishedAt: publishedAt.toISOString() });
    });
  } catch (error) {
    return errorResponse(error);
  }
});
