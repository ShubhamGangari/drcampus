import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createRouteSchema } from '@/lib/transport-schemas';
import { resolveCreateTenant, tenantFilter, userHasPermission, parseStops } from '@/lib/transport-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/transport/routes?schoolId=
// 200 { routes: [{ id, name, stops: [{name, order, time}], distanceKm, active }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const routes = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            const rows = await db.transportRoute.findMany({
                where,
                orderBy: { name: 'asc' },
            });
            return rows.map((r) => ({
                id: r.id,
                name: r.name,
                stops: [...parseStops(r.stopsJson)].sort((a, b) => a.order - b.order),
                distanceKm: r.distanceKm,
                active: r.active,
            }));
        });

        return successResponse({ routes });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/transport/routes (transport.manage) → 201 { route }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'transport.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
        }

        const body = await validateBody(request, createRouteSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const route = await withClient(user, async (db) => {
            const stops = [...body.stops].sort((a, b) => a.order - b.order);
            const created = await db.transportRoute.create({
                data: {
                    schoolId: tenant,
                    name: body.name,
                    stopsJson: JSON.stringify(stops),
                    distanceKm: body.distanceKm ?? null,
                    active: true,
                },
            });
            return {
                id: created.id,
                name: created.name,
                stops: parseStops(created.stopsJson),
                distanceKm: created.distanceKm,
                active: created.active,
            };
        });

        return successResponse({ route }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
