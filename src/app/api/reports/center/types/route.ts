import { withAuth, successResponse, errorResponse } from '@/lib/api';
import { resolveUserEffectivePermissions } from '@/lib/rbac';
import { REPORT_TYPES, canUseReportType } from '@/lib/reports-center-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/reports/center/types
// Returns the whitelisted report types the authenticated user may use, grouped
// by domain. Filtered by `canUseReportType` (super-admin, registrar, custom
// roles with reports.view/manage, and built-in domain roles).
// 200 { types: [{ key, domain, label, description, filters }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_request, { user }) => {
    try {
        const effective = await resolveUserEffectivePermissions(user);

        const types = REPORT_TYPES.filter((t) =>
            canUseReportType({ role: user.role, permissions: effective }, t.key)
        ).map((t) => ({
            key: t.key,
            domain: t.domain,
            label: t.label,
            description: t.description,
            filters: t.filters,
        }));

        return successResponse({ types });
    } catch (error) {
        return errorResponse(error);
    }
});
