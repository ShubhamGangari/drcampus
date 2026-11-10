import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateVisitSchema } from '@/lib/health-schemas';
import { resolveCreateTenant, userHasPermission, requireHealthManage, validateVisitPayload } from '@/lib/health-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/health/visits/[id] — update a visit (health.manage).
// Body: { status?, prescription?, followUpDate? }. 200 { visit }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'health.manage'))) {
            throw requireHealthManage();
        }

        const body = await validateBody(request, updateVisitSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const check = validateVisitPayload(body);
        if (!check.valid) {
            throw new ApiError(400, 'VALIDATION_FAILED', check.error ?? 'Invalid visit payload');
        }

        const visit = await withClient(user, async (db) => {
            const existing = await db.healthVisit.findUnique({ where: { id: params.id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Visit not found');
            }
            if (existing.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Visit does not belong to this school');
            }

            const data: Record<string, unknown> = {};
            if (body.status !== undefined) data.status = body.status;
            if (body.prescription !== undefined) data.prescription = body.prescription;
            if (body.followUpDate !== undefined) {
                data.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
            }

            return db.healthVisit.update({ where: { id: existing.id }, data });
        });

        return successResponse({ visit });
    } catch (error) {
        return errorResponse(error);
    }
});
