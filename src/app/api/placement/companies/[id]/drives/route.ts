import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createDriveSchema } from '@/lib/placement-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    requirePlacementManage,
} from '@/lib/placement-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/placement/companies/[id]/drives — create a drive for a company
// (placement.manage). 201 { drive }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'placement.manage'))) {
            throw requirePlacementManage();
        }

        const body = await validateBody(request, createDriveSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const drive = await withClient(user, async (db) => {
            const company = await db.placementCompany.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: params.id },
                select: { id: true },
            });
            if (!company) {
                throw new ApiError(404, 'NOT_FOUND', 'Company not found');
            }

            const created = await db.placementDrive.create({
                data: {
                    schoolId: tenant,
                    companyId: params.id,
                    title: body.title,
                    date: new Date(body.date),
                    mode: body.mode,
                    role: body.role,
                    package: body.package ?? null,
                    location: body.location ?? null,
                },
            });

            return {
                id: created.id,
                title: created.title,
                date: created.date.toISOString(),
                mode: created.mode,
                role: created.role,
                package: created.package,
                location: created.location,
            };
        });

        return successResponse({ drive }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
