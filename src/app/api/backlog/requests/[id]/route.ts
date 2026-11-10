import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateRevaluationSchema } from '@/lib/backlog-schemas';
import {
    canTransitionRevaluation,
    userHasPermission,
    requireBacklogManage,
} from '@/lib/backlog-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/backlog/requests/:id  (manage — backlog.manage)
// Admin reviews a revaluation request: approve/reject (REQUESTED) or complete
// (APPROVED). Enforces canTransitionRevaluation. 200 { request }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        const body = await validateBody(request, updateRevaluationSchema);

        if (!(await userHasPermission(user, 'backlog.manage'))) {
            throw requireBacklogManage();
        }

        const updated = await withClient(user, async (db) => {
            const existing = await db.revaluationRequest.findUnique({ where: { id: params.id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Revaluation request not found');
            }
            if (!canTransitionRevaluation(existing.status, body.status)) {
                throw new ApiError(
                    400,
                    'INVALID_STATUS_TRANSITION',
                    `Cannot transition from ${existing.status} to ${body.status}`
                );
            }

            return db.revaluationRequest.update({
                where: { id: params.id },
                data: {
                    status: body.status,
                    remark: body.remark ?? null,
                },
            });
        });

        return successResponse({ request: updated });
    } catch (error) {
        return errorResponse(error);
    }
});
