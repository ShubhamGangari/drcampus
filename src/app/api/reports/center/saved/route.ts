import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, validateBody, ApiError } from '@/lib/api';
import { resolveUserEffectivePermissions } from '@/lib/rbac';
import {
    canUseReportType,
    listSavedReports,
    saveSavedReport,
} from '@/lib/reports-center-core';
import { createSavedReportSchema } from '@/lib/reports-center-schemas';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/reports/center/saved?schoolId=
// Lists the authenticated user's saved reports, scoped by owner + school.
// 200 { saved: [{ id, name, type, filters, createdAt }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = isCentralUser(user)
            ? (url.searchParams.get('schoolId') ?? '')
            : user.schoolId;

        const saved = await withClient(user, async (db) => listSavedReports(db, schoolId, user.userId));
        return successResponse({ saved });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/reports/center/saved
// Saves the current report filters as a bookmark for quick re-run. The user must
// have domain access to the report type (403 otherwise). Validation → 400.
// 201 { saved: { id, name, type, filters, createdAt } }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createSavedReportSchema);

        const effective = await resolveUserEffectivePermissions(user);
        if (!canUseReportType({ role: user.role, permissions: effective }, body.type)) {
            throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this report type');
        }

        const url = new URL(request.url);
        const schoolId = isCentralUser(user)
            ? (url.searchParams.get('schoolId') ?? '')
            : user.schoolId;

        const saved = await withClient(user, async (db) =>
            saveSavedReport(db, {
                schoolId,
                ownerId: user.userId,
                name: body.name,
                type: body.type,
                filters: body.filters ?? {},
            })
        );

        return successResponse({ saved }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
