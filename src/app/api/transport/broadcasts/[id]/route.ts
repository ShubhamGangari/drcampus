import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { userHasPermission } from '@/lib/transport-core';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateBroadcastSchema = z.object({
    active: z.boolean().optional(),
    title: z.string().min(1).max(200).optional(),
    message: z.string().min(1).max(1000).optional(),
    delayMin: z.number().int().min(0).max(300).optional().nullable(),
});

// ---------------------------------------------------------------------------
// PATCH /api/transport/broadcasts/[id]
// Toggle active/resolved or edit broadcast
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        const hasPerm = await userHasPermission(user, 'transport.manage');
        const allowedRoles = ['SUPER_ADMIN', 'REGISTRAR_ADMIN', 'DEAN', 'FACULTY'];
        if (!hasPerm && !allowedRoles.includes(user.role)) {
            throw new ApiError(403, 'FORBIDDEN', 'Permission required to update transport broadcasts');
        }

        const id = params?.id as string;
        if (!id) {
            throw new ApiError(400, 'BAD_REQUEST', 'Broadcast id required');
        }

        const body = await validateBody(request, updateBroadcastSchema);

        const updated = await withClient(user, async (db) => {
            const existing = await db.transportBroadcast.findUnique({
                where: { id },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Broadcast not found');
            }

            return await db.transportBroadcast.update({
                where: { id },
                data: {
                    active: body.active !== undefined ? body.active : existing.active,
                    title: body.title ?? existing.title,
                    message: body.message ?? existing.message,
                    delayMin: body.delayMin !== undefined ? body.delayMin : existing.delayMin,
                },
            });
        });

        return successResponse({ broadcast: updated });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/transport/broadcasts/[id]
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
    try {
        const hasPerm = await userHasPermission(user, 'transport.manage');
        const allowedRoles = ['SUPER_ADMIN', 'REGISTRAR_ADMIN', 'DEAN'];
        if (!hasPerm && !allowedRoles.includes(user.role)) {
            throw new ApiError(403, 'FORBIDDEN', 'Permission required to delete transport broadcasts');
        }

        const id = params?.id as string;
        if (!id) {
            throw new ApiError(400, 'BAD_REQUEST', 'Broadcast id required');
        }

        await withClient(user, async (db) => {
            const existing = await db.transportBroadcast.findUnique({
                where: { id },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Broadcast not found');
            }

            await db.transportBroadcast.delete({
                where: { id },
            });
        });

        return successResponse({ deleted: true });
    } catch (error) {
        return errorResponse(error);
    }
});
