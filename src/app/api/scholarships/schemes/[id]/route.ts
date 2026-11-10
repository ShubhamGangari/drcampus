import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateSchemeSchema } from '@/lib/scholarships-schemas';
import { userHasPermission, requireScholarshipsManage } from '@/lib/scholarships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/scholarships/schemes/[id] — update a scheme (scholarships.manage)
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'scholarships.manage'))) {
            throw requireScholarshipsManage();
        }

        const id = params.id;
        const body = await validateBody(request, updateSchemeSchema);

        const scheme = await withClient(user, async (db) => {
            const existing = await db.scholarshipScheme.findUnique({ where: { id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Scheme not found');
            }
            const updated = await db.scholarshipScheme.update({
                where: { id },
                data: {
                    ...(body.name !== undefined && { name: body.name }),
                    ...(body.type !== undefined && { type: body.type }),
                    ...(body.value !== undefined && { value: body.value }),
                    ...(body.valueKind !== undefined && { valueKind: body.valueKind }),
                    ...(body.criteriaJson !== undefined && { criteriaJson: body.criteriaJson }),
                    ...(body.active !== undefined && { active: body.active }),
                },
            });
            return {
                id: updated.id,
                name: updated.name,
                type: updated.type,
                value: updated.value,
                valueKind: updated.valueKind,
                criteriaJson: updated.criteriaJson,
                active: updated.active,
            };
        });

        return successResponse({ scheme });
    } catch (error) {
        return errorResponse(error);
    }
});
