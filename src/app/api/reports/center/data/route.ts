import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { resolveUserEffectivePermissions } from '@/lib/rbac';
import { isReportType, canUseReportType, buildReportData } from '@/lib/reports-center-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/reports/center/data?type=&from=&to=&studentId=&examId=&courseId=&cycleId=&status=
// Returns aggregated preview rows for a report type. Gated by domain permission;
// unknown type → 400, lacking permission → 403. All queries are tenant-scoped.
// 200 { columns: string[], rows: Record<string, unknown>[] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const type = url.searchParams.get('type');

        const effective = await resolveUserEffectivePermissions(user);
        if (!isReportType(type)) {
            throw new ApiError(400, 'UNKNOWN_REPORT_TYPE', 'Unknown report type');
        }
        if (!canUseReportType({ role: user.role, permissions: effective }, type)) {
            throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this report type');
        }

        const schoolId = isCentralUser(user)
            ? (url.searchParams.get('schoolId') ?? '')
            : user.schoolId;

        const table = await withClient(user, async (db) => buildReportData(db, schoolId, type, url));
        return successResponse({ columns: table.columns, rows: table.rows });
    } catch (error) {
        return errorResponse(error);
    }
});
