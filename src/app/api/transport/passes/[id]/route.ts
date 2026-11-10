import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updatePassSchema } from '@/lib/transport-schemas';
import { userHasPermission, computePassValidity, parseStops } from '@/lib/transport-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/transport/passes/[id] (transport.manage) → 200 { pass }
// Renew/expire/activate a pass by setting status. Status is recomputed on read.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'transport.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
        }

        const body = await validateBody(request, updatePassSchema);

        const pass = await withClient(user, async (db) => {
            const existing = await db.transportPass.findUnique({
                where: { id: params.id },
                include: { route: { select: { name: true, stopsJson: true } } },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Pass not found');
            }

            const updated = await db.transportPass.update({
                where: { id: existing.id },
                data: body.status !== undefined ? { status: body.status } : {},
                include: { route: { select: { name: true, stopsJson: true } } },
            });

            const stops = parseStops(updated.route.stopsJson);
            return {
                id: updated.id,
                studentId: updated.studentId,
                studentName: 'Unknown',
                rollNo: null,
                routeId: updated.routeId,
                routeName: updated.route.name,
                routeStops: stops.sort((a, b) => a.order - b.order),
                stop: updated.stop,
                validFrom: updated.validFrom.toISOString(),
                validTo: updated.validTo.toISOString(),
                fee: updated.fee,
                status: computePassValidity(updated, new Date()),
            };
        });

        return successResponse({ pass });
    } catch (error) {
        return errorResponse(error);
    }
});
