import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateRouteSchema } from '@/lib/transport-schemas';
import {
    userHasPermission,
    parseStops,
    assertRouteBelongsToSchool,
} from '@/lib/transport-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/transport/routes/[id] (transport.manage) → 200 { route }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'transport.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
        }

        const body = await validateBody(request, updateRouteSchema);

        const route = await withClient(user, async (db) => {
            const schoolId = user.schoolId === 'ALL' ? body.schoolId : user.schoolId;
            const existing = await assertRouteBelongsToSchool(db, params.id, schoolId ?? '');

            const data: Record<string, unknown> = {};
            if (body.name !== undefined) data.name = body.name;
            if (body.distanceKm !== undefined) data.distanceKm = body.distanceKm;
            if (body.active !== undefined) data.active = body.active;
            if (body.stops !== undefined) {
                data.stopsJson = JSON.stringify([...body.stops].sort((a, b) => a.order - b.order));
            }

            const updated = await db.transportRoute.update({
                where: { id: existing.id },
                data,
            });
            return {
                id: updated.id,
                name: updated.name,
                stops: parseStops(updated.stopsJson),
                distanceKm: updated.distanceKm,
                active: updated.active,
            };
        });

        return successResponse({ route });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/transport/routes/[id] (transport.manage) → 200 { success }
// Deleting a route with assigned vehicles is rejected with 409.
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'transport.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
        }

        await withClient(user, async (db) => {
            const url = new URL(request.url);
            const schoolId = url.searchParams.get('schoolId') ?? user.schoolId;
            const existing = await assertRouteBelongsToSchool(db, params.id, schoolId);

            const vehicleCount = await db.transportVehicle.count({ where: { routeId: existing.id } });
            if (vehicleCount > 0) {
                throw new ApiError(409, 'ROUTE_HAS_VEHICLES', 'Cannot delete a route with assigned vehicles');
            }

            await db.transportRoute.delete({ where: { id: existing.id } });
        });

        return successResponse({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
});
