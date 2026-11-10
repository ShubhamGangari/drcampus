import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { hasPermission } from '@/lib/perms';
import { resolveCreateTenant } from '@/lib/student-lifecycle';
import { fetchLiveClasses } from '@/lib/governance-queries';
import { istNow } from '@/lib/governance-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/governance/live-classes?schoolId=&departmentId= (DEAN /
//   REGISTRAR_ADMIN / SUPER_ADMIN). Returns the same liveClasses list as the
//   overview endpoint (only the list).
// Errors: 403 not permitted; 400 central user missing schoolId.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        if (!hasPermission(user.role, user.position, 'dean.dashboard')) {
            throw new ApiError(403, 'FORBIDDEN', 'Dean dashboard access required');
        }

        return await withClient(user, async (db) => {
            const url = new URL(request.url);
            const schoolId = resolveCreateTenant(user, url.searchParams.get('schoolId') || undefined);
            const departmentId = url.searchParams.get('departmentId') || undefined;

            const liveClasses = await fetchLiveClasses(db, schoolId, departmentId, istNow());
            return successResponse({ liveClasses });
        });
    } catch (error) {
        return errorResponse(error);
    }
});
