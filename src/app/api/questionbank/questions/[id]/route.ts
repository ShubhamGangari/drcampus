import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateQuestionSchema } from '@/lib/questionbank-schemas';
import {
    canTransitionQuestionStatus,
    userHasPermission,
    requireQuestionbankManage,
} from '@/lib/questionbank-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/questionbank/questions/:id  (manage — questionbank.manage)
// Admin approves/rejects a submitted question. Enforces
// canTransitionQuestionStatus (DRAFT→SUBMITTED→APPROVED|REJECTED). 200
// { question }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        const body = await validateBody(request, updateQuestionSchema);

        if (!(await userHasPermission(user, 'questionbank.manage'))) {
            throw requireQuestionbankManage();
        }

        const question = await withClient(user, async (db) => {
            const existing = await db.question.findUnique({ where: { id: params.id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Question not found');
            }
            if (!canTransitionQuestionStatus(existing.status, body.status)) {
                throw new ApiError(
                    400,
                    'INVALID_STATUS_TRANSITION',
                    `Cannot transition from ${existing.status} to ${body.status}`
                );
            }

            return db.question.update({
                where: { id: params.id },
                data: {
                    status: body.status,
                    remark: body.remark ?? null,
                },
            });
        });

        return successResponse({ question });
    } catch (error) {
        return errorResponse(error);
    }
});
