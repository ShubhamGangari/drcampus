import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createWindowSchema } from '@/lib/registration-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
} from '@/lib/registration-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/registration/windows?schoolId=
// Lists registration windows. Read-only, self-service. 200
// { windows: [{ id, semester, academicYear, opensAt, closesAt, active }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const windows = await withClient(user, async (db) => {
            const rows = await db.courseRegistrationWindow.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }],
            });
            return rows.map((w) => ({
                id: w.id,
                semester: w.semester,
                academicYear: w.academicYear,
                opensAt: w.opensAt.toISOString(),
                closesAt: w.closesAt.toISOString(),
                active: w.active,
            }));
        });

        return successResponse({ windows });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/registration/windows — create/activate a window (registration.manage).
// 201 { window }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'registration.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Registration management permission required');
        }

        const body = await validateBody(request, createWindowSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const window = await withClient(user, async (db) => {
            const created = await db.courseRegistrationWindow.create({
                data: {
                    schoolId: tenant,
                    semester: body.semester,
                    academicYear: body.academicYear,
                    opensAt: new Date(body.opensAt),
                    closesAt: new Date(body.closesAt),
                    active: true,
                },
            });
            return {
                id: created.id,
                semester: created.semester,
                academicYear: created.academicYear,
                opensAt: created.opensAt.toISOString(),
                closesAt: created.closesAt.toISOString(),
                active: created.active,
            };
        });

        return successResponse({ window }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
