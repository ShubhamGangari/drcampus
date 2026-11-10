import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    errorResponse,
} from '@/lib/api';
import { tenantFilter } from '@/lib/mentorship-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/mentorship/mentors?schoolId=
// Lists available alumni mentors. 200
// { mentors: [{ id, name, field, company, experience, available }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const mentors = await withClient(user, async (db) => {
            const rows = await db.mentorProfile.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { createdAt: 'desc' },
            });

            return rows.map((r) => ({
                id: r.id,
                name: r.name,
                field: r.field,
                company: r.company,
                experience: r.experience,
                available: r.available,
            }));
        });

        return successResponse({ mentors });
    } catch (error) {
        return errorResponse(error);
    }
});
