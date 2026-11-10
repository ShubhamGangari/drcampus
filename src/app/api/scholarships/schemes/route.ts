import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse } from '@/lib/api';
import { createSchemeSchema } from '@/lib/scholarships-schemas';
import { resolveCreateTenant, tenantFilter, userHasPermission, requireScholarshipsManage } from '@/lib/scholarships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/scholarships/schemes?active=&schoolId=
// Any authenticated user may browse schemes (self-service). 200 { schemes }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const activeParam = url.searchParams.get('active');

        const schemes = await withClient(user, async (db) => {
            const where = tenantFilter(isCentralUser(user), schoolId) as Record<string, unknown>;
            if (activeParam !== null && activeParam !== '') {
                where.active = activeParam === 'true';
            }
            const rows = await db.scholarshipScheme.findMany({
                where,
                orderBy: { name: 'asc' },
            });
            return rows.map((s) => ({
                id: s.id,
                name: s.name,
                type: s.type,
                value: s.value,
                valueKind: s.valueKind,
                criteriaJson: s.criteriaJson,
                active: s.active,
            }));
        });

        return successResponse({ schemes });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/scholarships/schemes — create a scheme (scholarships.manage)
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'scholarships.manage'))) {
            throw requireScholarshipsManage();
        }

        const body = await validateBody(request, createSchemeSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const scheme = await withClient(user, async (db) => {
            const created = await db.scholarshipScheme.create({
                data: {
                    schoolId: tenant,
                    name: body.name,
                    type: body.type,
                    value: body.value,
                    valueKind: body.valueKind,
                    criteriaJson: body.criteriaJson,
                },
            });
            return {
                id: created.id,
                name: created.name,
                type: created.type,
                value: created.value,
                valueKind: created.valueKind,
                criteriaJson: created.criteriaJson,
                active: created.active,
            };
        });

        return successResponse({ scheme }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
