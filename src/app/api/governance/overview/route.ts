import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { hasPermission } from '@/lib/perms';
import { resolveCreateTenant } from '@/lib/student-lifecycle';
import { fetchFacultyUsers, fetchLiveClasses, resolveFacultyPresence } from '@/lib/governance-queries';
import { istNow, dateStringInZone, IST_ZONE } from '@/lib/governance-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/governance/overview?schoolId=&departmentId= (DEAN / REGISTRAR_ADMIN
//   / SUPER_ADMIN).
// Returns KPI cards + live/upcoming classes + today's faculty presence.
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

            const now = istNow();
            const todayStr = dateStringInZone(new Date(), IST_ZONE);
            const todayObj = new Date(todayStr + 'T00:00:00.000Z');

            const [faculty, liveClasses, departmentCount] = await Promise.all([
                fetchFacultyUsers(db, schoolId, departmentId),
                fetchLiveClasses(db, schoolId, departmentId, now),
                departmentId ? Promise.resolve(1) : db.department.count({ where: { schoolId } }),
            ]);

            const presence = await resolveFacultyPresence(db, schoolId, faculty, todayObj, todayStr);

            return successResponse({
                kpis: {
                    facultyCount: faculty.length,
                    presentToday: presence.filter((p) => p.status === 'PRESENT').length,
                    liveClasses: liveClasses.filter((lc) => lc.status === 'LIVE').length,
                    departmentCount,
                },
                liveClasses,
                presence,
            });
        });
    } catch (error) {
        return errorResponse(error);
    }
});
