import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateRecordSchema } from '@/lib/health-schemas';
import { resolveCreateTenant, userHasPermission, requireHealthManage } from '@/lib/health-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/health/records/[studentId] — edit a student's health record.
// Guarded by health.manage. Body: { bloodGroup?, allergies?, chronicConditions?,
// emergencyContact? }. 200 { record }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'health.manage'))) {
            throw requireHealthManage();
        }

        const body = await validateBody(request, updateRecordSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const record = await withClient(user, async (db) => {
            const existing = await db.studentHealthRecord.findUnique({
                where: { studentId: params.studentId },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Health record not found');
            }
            if (existing.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Record does not belong to this school');
            }

            const data: Record<string, unknown> = {};
            if (body.bloodGroup !== undefined) data.bloodGroup = body.bloodGroup;
            if (body.allergies !== undefined) data.allergies = body.allergies;
            if (body.chronicConditions !== undefined) data.chronicConditions = body.chronicConditions;
            if (body.emergencyContact !== undefined) data.emergencyContact = body.emergencyContact;

            return db.studentHealthRecord.update({ where: { id: existing.id }, data });
        });

        return successResponse({ record });
    } catch (error) {
        return errorResponse(error);
    }
});
