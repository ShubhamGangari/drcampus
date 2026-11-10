import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { updateCompanySchema } from '@/lib/placement-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    requirePlacementManage,
} from '@/lib/placement-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/placement/companies/[id] — update a company (placement.manage).
// 200 { company }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'placement.manage'))) {
            throw requirePlacementManage();
        }

        const body = await validateBody(request, updateCompanySchema);
        const tenant = resolveCreateTenant(user, undefined);

        const company = await withClient(user, async (db) => {
            const existing = await db.placementCompany.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: params.id },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Company not found');
            }

            try {
                const updated = await db.placementCompany.update({
                    where: { id: params.id },
                    data: {
                        ...(body.name !== undefined ? { name: body.name } : {}),
                        ...(body.sector !== undefined ? { sector: body.sector } : {}),
                    },
                });
                return { id: updated.id, name: updated.name, sector: updated.sector };
            } catch (err: unknown) {
                if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
                    throw new ApiError(409, 'DUPLICATE_COMPANY', 'A company with this name already exists');
                }
                throw err;
            }
        });

        return successResponse({ company });
    } catch (error) {
        return errorResponse(error);
    }
});
