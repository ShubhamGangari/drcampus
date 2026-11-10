import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createCompanySchema } from '@/lib/placement-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    requirePlacementManage,
} from '@/lib/placement-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/placement/companies?schoolId=
// Lists companies with their drives. Read-only, self-service. 200
// { companies: [{ id, name, sector, drives: [{ id, title, date, mode, role,
//                  package, location }] }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const companies = await withClient(user, async (db) => {
            const rows = await db.placementCompany.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { name: 'asc' },
            });

            const companyIds = rows.map((c) => c.id);
            const drives = companyIds.length
                ? await db.placementDrive.findMany({
                    where: { companyId: { in: companyIds } },
                    orderBy: { date: 'desc' },
                })
                : [];
            const driveMap = new Map<string, typeof drives>();
            for (const d of drives) {
                const list = driveMap.get(d.companyId) ?? [];
                list.push(d);
                driveMap.set(d.companyId, list);
            }

            return rows.map((c) => ({
                id: c.id,
                name: c.name,
                sector: c.sector,
                drives: (driveMap.get(c.id) ?? []).map((d) => ({
                    id: d.id,
                    title: d.title,
                    date: d.date.toISOString(),
                    mode: d.mode,
                    role: d.role,
                    package: d.package,
                    location: d.location,
                })),
            }));
        });

        return successResponse({ companies });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/placement/companies — create a company (placement.manage). 201 { company }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'placement.manage'))) {
            throw requirePlacementManage();
        }

        const body = await validateBody(request, createCompanySchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const company = await withClient(user, async (db) => {
            try {
                const created = await db.placementCompany.create({
                    data: {
                        schoolId: tenant,
                        name: body.name,
                        sector: body.sector ?? null,
                    },
                });
                return { id: created.id, name: created.name, sector: created.sector, drives: [] };
            } catch (err: unknown) {
                if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
                    throw new ApiError(409, 'DUPLICATE_COMPANY', 'A company with this name already exists');
                }
                throw err;
            }
        });

        return successResponse({ company }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
