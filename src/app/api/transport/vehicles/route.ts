import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createVehicleSchema } from '@/lib/transport-schemas';
import { resolveCreateTenant, tenantFilter, userHasPermission, canAssignVehicle } from '@/lib/transport-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/transport/vehicles?schoolId= → 200 { vehicles }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const vehicles = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            const rows = await db.transportVehicle.findMany({
                where,
                orderBy: { registrationNo: 'asc' },
                include: { route: { select: { name: true } } },
            });
            return rows.map((v) => ({
                id: v.id,
                registrationNo: v.registrationNo,
                type: v.type,
                capacity: v.capacity,
                routeId: v.routeId,
                routeName: v.route?.name ?? null,
                status: v.status,
            }));
        });

        return successResponse({ vehicles });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/transport/vehicles (transport.manage) → 201 { vehicle }
// A MAINTENANCE vehicle cannot be assigned to a route (400).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'transport.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
        }

        const body = await validateBody(request, createVehicleSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        if (body.routeId && !canAssignVehicle(body.status)) {
            throw new ApiError(
                400,
                'MAINTENANCE_VEHICLE',
                'A vehicle under maintenance cannot be assigned to a route'
            );
        }

        const vehicle = await withClient(user, async (db) => {
            if (body.routeId) {
                const route = await db.transportRoute.findUnique({ where: { id: body.routeId } });
                if (!route || route.schoolId !== tenant) {
                    throw new ApiError(404, 'NOT_FOUND', 'Route not found');
                }
            }

            const created = await db.transportVehicle.create({
                data: {
                    schoolId: tenant,
                    registrationNo: body.registrationNo,
                    type: body.type,
                    capacity: body.capacity,
                    routeId: body.routeId ?? null,
                    status: body.status,
                },
                include: { route: { select: { name: true } } },
            });
            return {
                id: created.id,
                registrationNo: created.registrationNo,
                type: created.type,
                capacity: created.capacity,
                routeId: created.routeId,
                routeName: created.route?.name ?? null,
                status: created.status,
            };
        });

        return successResponse({ vehicle }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
