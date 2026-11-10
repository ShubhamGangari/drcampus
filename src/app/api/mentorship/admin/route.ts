import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    errorResponse,
} from '@/lib/api';
import {
    tenantFilter,
    userHasPermission,
    requireMentorshipManage,
    resolveMentorNames,
    resolveStudentNames,
} from '@/lib/mentorship-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/mentorship/admin?schoolId=
// Staff overview of pairings plus high-level stats. 200
// { pairings: [...], stats: { mentors, mentees, activePairings } }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const canView = await userHasPermission(user, 'mentorship.view');
        const canManage = await userHasPermission(user, 'mentorship.manage');
        if (!canView && !canManage) {
            requireMentorshipManage();
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const data = await withClient(user, async (db) => {
            const rows = await db.mentorshipPairing.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { createdAt: 'desc' },
            });

            const mentorIds = Array.from(new Set(rows.map((r) => r.mentorId)));
            const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));

            const [mentorNames, studentNames, meetingsCounts] = await Promise.all([
                resolveMentorNames(db, mentorIds),
                resolveStudentNames(db, studentIds),
                Promise.all(rows.map((r) => db.mentorshipMeeting.count({ where: { pairingId: r.id } }))),
            ]);

            const pairings = rows.map((r, i) => ({
                id: r.id,
                mentorId: r.mentorId,
                mentorName: mentorNames.get(r.mentorId) ?? 'Mentor',
                studentId: r.studentId,
                studentName: studentNames.get(r.studentId) ?? 'Student',
                status: r.status,
                meetingsCount: meetingsCounts[i],
                createdAt: r.createdAt.toISOString(),
            }));

            const activePairings = rows.filter((r) => r.status === 'ACTIVE').length;
            const mentees = rows.filter((r) => r.status === 'ACTIVE').map((r) => r.studentId);

            const stats = {
                mentors: await db.mentorProfile.count({ where: tenantFilter(isCentralUser(user), schoolId) }),
                mentees: Array.from(new Set(mentees)).length,
                activePairings,
            };

            return { pairings, stats };
        });

        return successResponse(data);
    } catch (error) {
        return errorResponse(error);
    }
});
