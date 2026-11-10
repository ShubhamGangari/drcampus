import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { resolveUserEffectivePermissions } from '@/lib/rbac';
import {
    isReportType,
    getReportType,
    canUseReportType,
    requireReportFormat,
    buildReportData,
    reportToCsv,
    reportToPrintHtml,
} from '@/lib/reports-center-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/reports/center/export?type=&fmt=csv|pdf&...
// Renders a report using the same row builders as preview, then returns it as
// escaped CSV or a print-friendly HTML view for PDF. `fmt` is restricted to
// csv|pdf else 400 (spec §6).
// 200 { filename, content, contentType }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const fmt = requireReportFormat(url);
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

        const slug = (getReportType(type)?.label ?? 'report').replace(/\s+/g, '-').toLowerCase();
        if (fmt === 'csv') {
            return successResponse({
                filename: `${slug}.csv`,
                content: reportToCsv(table),
                contentType: 'text/csv',
            });
        }
        return successResponse({
            filename: `${slug}.html`,
            content: reportToPrintHtml(table),
            contentType: 'text/html',
        });
    } catch (error) {
        return errorResponse(error);
    }
});
