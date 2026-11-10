import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, validateBody, ApiError } from '@/lib/api';
import { hasPermission } from '@/lib/perms';
import { resolveCreateTenant } from '@/lib/student-lifecycle';
import { fetchFacultyUsers, resolveFacultyPresence } from '@/lib/governance-queries';
import { dateStringInZone, IST_ZONE } from '@/lib/governance-core';
import { facultyPresenceSchema } from '@/lib/governance-schemas';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// GET /api/governance/faculty-presence?schoolId=&departmentId=&date=&userId=
//   (DEAN / REGISTRAR_ADMIN / SUPER_ADMIN / FACULTY[view]).
// Returns the faculty presence list for a day (default: today IST), optionally
//   filtered to a department or a single user.
// Errors: 403 not permitted; 400 invalid date or central missing schoolId.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        if (!hasPermission(user.role, user.position, 'faculty.presence_view')) {
            throw new ApiError(403, 'FORBIDDEN', 'Faculty presence view access required');
        }

        return await withClient(user, async (db) => {
            const url = new URL(request.url);
            const schoolId = resolveCreateTenant(user, url.searchParams.get('schoolId') || undefined);
            const departmentId = url.searchParams.get('departmentId') || undefined;
            const userId = url.searchParams.get('userId') || undefined;

            const dateStr = url.searchParams.get('date') || dateStringInZone(new Date(), IST_ZONE);
            if (!DATE_RE.test(dateStr) || Number.isNaN(new Date(dateStr + 'T00:00:00.000Z').getTime())) {
                throw new ApiError(400, 'INVALID_DATE', 'date must be YYYY-MM-DD');
            }
            const dateObj = new Date(dateStr + 'T00:00:00.000Z');

            let faculty = await fetchFacultyUsers(db, schoolId, departmentId);
            if (userId) faculty = faculty.filter((f) => f.userId === userId);

            const items = await resolveFacultyPresence(db, schoolId, faculty, dateObj, dateStr);
            return successResponse({ items });
        });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/governance/faculty-presence — upsert a daily presence row.
//   Body: { schoolId?, userId, date: YYYY-MM-DD, status }.
//   DEAN / REGISTRAR_ADMIN / SUPER_ADMIN may set any faculty; FACULTY may only
//   set their own row (403 self-only violation otherwise).
// Errors: 400 invalid body/date; 403 not permitted or self-only violation;
//         404 target user not an active faculty in school.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const canManage = hasPermission(user.role, user.position, 'faculty.presence_manage');
        if (!canManage && user.role !== 'FACULTY') {
            throw new ApiError(403, 'FORBIDDEN', 'Not permitted to manage faculty presence');
        }

        const body = await validateBody(request, facultyPresenceSchema);

        if (!canManage && body.userId !== user.userId) {
            throw new ApiError(403, 'SELF_ONLY', 'Faculty may only set their own presence');
        }

        return await withClient(user, async (db) => {
            const schoolId = resolveCreateTenant(user, body.schoolId);

            const target = await db.user.findFirst({
                where: { schoolId, id: body.userId, active: true, role: 'FACULTY' },
                select: { id: true },
            });
            if (!target) {
                throw new ApiError(404, 'FACULTY_NOT_FOUND', 'Target user is not an active faculty member in this school');
            }

            const dateObj = new Date(body.date + 'T00:00:00.000Z');
            await db.facultyPresence.upsert({
                where: { schoolId_userId_date: { schoolId, userId: body.userId, date: dateObj } },
                create: { schoolId, userId: body.userId, date: dateObj, status: body.status, markedBy: user.userId },
                update: { status: body.status, markedBy: user.userId },
            });

            await writeAuditLog(db, {
                schoolId,
                actorId: user.userId,
                action: 'FACULTY_PRESENCE_UPDATED',
                entityType: 'FACULTY_PRESENCE',
                entityId: body.userId,
                summary: `${body.status} for faculty ${body.userId} on ${body.date}`,
            });

            return successResponse({
                updated: true,
                presence: { userId: body.userId, date: body.date, status: body.status, markedBy: user.userId },
            });
        });
    } catch (error) {
        return errorResponse(error);
    }
});
