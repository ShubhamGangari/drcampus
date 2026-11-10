import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateGrievanceSchema } from '@/lib/grievance-schemas';
import {
    userHasPermission,
    requireGrievanceManage,
    requireGrievanceView,
    canTransitionStatus,
} from '@/lib/grievance-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/grievance/[id] — ticket detail + message thread.
// Access: the ticket owner, or grievance.view / grievance.manage. 200 { ticket, messages }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_request, { user, params }) => {
    try {
        const id = params.id;

        const result = await withClient(user, async (db) => {
            const existing = await db.grievance.findUnique({
                where: { id },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        select: { id: true, authorId: true, body: true, createdAt: true },
                    },
                },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Grievance ticket not found');
            }

            const canView =
                existing.requesterId === user.userId ||
                (await userHasPermission(user, 'grievance.view')) ||
                (await userHasPermission(user, 'grievance.manage'));
            if (!canView) throw requireGrievanceView();

            return existing;
        });

        return successResponse({
            ticket: {
                id: result.id,
                ticketNo: result.ticketNo,
                category: result.category,
                subject: result.subject,
                description: result.description,
                status: result.status,
                priority: result.priority,
                requesterId: result.requesterId,
                assigneeUserId: result.assigneeUserId,
                resolution: result.resolution,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
            },
            messages: result.messages,
        });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// PATCH /api/grievance/[id] — update status/priority/assignee/resolution.
// Requires grievance.manage. Enforces the frozen status state machine and the
// "resolution note required before resolving" rule. 200 { ticket }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'grievance.manage'))) throw requireGrievanceManage();

        const body = await validateBody(request, updateGrievanceSchema);
        const id = params.id;

        const ticket = await withClient(user, async (db) => {
            const existing = await db.grievance.findUnique({ where: { id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Grievance ticket not found');
            }

            const nextStatus = body.status ?? existing.status;
            if (body.status && body.status !== existing.status && !canTransitionStatus(existing.status, body.status)) {
                throw new ApiError(400, 'INVALID_TRANSITION', 'Illegal status transition');
            }

            // Resolution requires a non-empty note before marking RESOLVED.
            const resolvedNote = body.resolution?.trim() ?? existing.resolution?.trim();
            if (nextStatus === 'RESOLVED' && !resolvedNote) {
                throw new ApiError(400, 'RESOLUTION_REQUIRED', 'A resolution note is required before resolving');
            }

            // Setting URGENT requires management (the whole PATCH is already gated above).
            return db.grievance.update({
                where: { id },
                data: {
                    status: nextStatus,
                    priority: body.priority !== undefined ? body.priority : existing.priority,
                    assigneeUserId: body.assigneeUserId !== undefined ? body.assigneeUserId : existing.assigneeUserId,
                    resolution: body.resolution !== undefined ? body.resolution : existing.resolution,
                },
                select: {
                    id: true,
                    ticketNo: true,
                    category: true,
                    subject: true,
                    status: true,
                    priority: true,
                    requesterId: true,
                    assigneeUserId: true,
                    resolution: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
        });

        return successResponse({ ticket });
    } catch (error) {
        return errorResponse(error);
    }
});
