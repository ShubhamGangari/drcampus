import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createGrievanceMessageSchema } from '@/lib/grievance-schemas';
import { userHasPermission, requireGrievanceView } from '@/lib/grievance-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/grievance/[id]/messages — append a message to a ticket.
// Access: the ticket owner, or grievance.view / grievance.manage. 201 { message }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
    try {
        const id = params.id;
        const body = await validateBody(request, createGrievanceMessageSchema);

        const message = await withClient(user, async (db) => {
            const ticket = await db.grievance.findUnique({
                where: { id },
                select: { id: true, requesterId: true },
            });
            if (!ticket) {
                throw new ApiError(404, 'NOT_FOUND', 'Grievance ticket not found');
            }

            const canPost =
                ticket.requesterId === user.userId ||
                (await userHasPermission(user, 'grievance.view')) ||
                (await userHasPermission(user, 'grievance.manage'));
            if (!canPost) throw requireGrievanceView();

            return db.grievanceMessage.create({
                data: { grievanceId: id, authorId: user.userId, body: body.body },
                select: { id: true, authorId: true, body: true, createdAt: true },
            });
        });

        return successResponse({ message }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
