import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateVehicleSchema } from '@/lib/transport-schemas';
import { userHasPermission } from '@/lib/transport-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/transport/vehicles/[id] (transport.manage) → 200 { vehicle }
// A MAINTENANCE vehicle cannot be assigned to a route (400).
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'transport.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
        }

        const body = await validateBody(request, updateVehicleSchema);

        if (body.routeId && body.status === 'MAINTENANCE') {
            throw new ApiError(
                400,
                'MAINTENANCE_VEHICLE',
                'A vehicle under maintenance cannot be assigned to a route'
            );
        }

        const vehicle = await withClient(user, async (db) => {
            const existing = await db.transportVehicle.findUnique({ where: { id: params.id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Vehicle not found');
            }

            const data: Record<string, unknown> = {};
            if (body.registrationNo !== undefined) data.registrationNo = body.registrationNo;
            if (body.type !== undefined) data.type = body.type;
            if (body.capacity !== undefined) data.capacity = body.capacity;
            if (body.status !== undefined) data.status = body.status;

            if (body.routeId !== undefined) {
                if (body.routeId === null) {
                    data.routeId = null;
                } else {
                    const route = await db.transportRoute.findUnique({ where: { id: body.routeId } });
                    if (!route) {
                        throw new ApiError(404, 'NOT_FOUND', 'Route not found');
                    }
                    data.routeId = route.id;
                }
            }

            const updated = await db.transportVehicle.update({
                where: { id: existing.id },
                data,
                include: { route: { select: { name: true } } },
            });
            return {
                id: updated.id,
                registrationNo: updated.registrationNo,
                type: updated.type,
                capacity: updated.capacity,
                routeId: updated.routeId,
                routeName: updated.route?.name ?? null,
                status: updated.status,
            };
        });

        return successResponse({ vehicle });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/transport/vehicles/[id] (transport.manage) → 200 { success }
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'transport.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
        }

        await withClient(user, async (db) => {
            const existing = await db.transportVehicle.findUnique({ where: { id: params.id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Vehicle not found');
            }
            await db.transportVehicle.delete({ where: { id: existing.id } });
        });

        return successResponse({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
});
