import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { revaluationRequestSchema } from '@/lib/backlog-schemas';
import { findSelfStudent } from '@/lib/backlog-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/backlog/:id/revaluation
// Student requests revaluation of a backlog script. Allowed ONCE per backlog
// (else 409 REVALUATION_ALREADY_REQUESTED). 201 { request }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
    try {
        const body = await validateBody(request, revaluationRequestSchema);

        const created = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const backlog = await db.backlogEntry.findUnique({ where: { id: params.id } });
            if (!backlog) {
                throw new ApiError(404, 'NOT_FOUND', 'Backlog entry not found');
            }
            if (backlog.studentId !== self.id) {
                throw new ApiError(403, 'FORBIDDEN', 'This backlog does not belong to your account');
            }

            const existing = await db.revaluationRequest.findFirst({
                where: { backlogId: backlog.id },
            });
            if (existing) {
                throw new ApiError(
                    409,
                    'REVALUATION_ALREADY_REQUESTED',
                    'Revaluation has already been requested for this backlog'
                );
            }

            return db.revaluationRequest.create({
                data: {
                    schoolId: backlog.schoolId,
                    backlogId: backlog.id,
                    studentId: self.id,
                    reason: body.reason,
                    status: 'REQUESTED',
                },
            });
        });

        return successResponse({ request: created }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
