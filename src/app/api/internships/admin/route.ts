import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    errorResponse,
} from '@/lib/api';
import {
    tenantFilter,
    userHasPermission,
    requireInternshipView,
} from '@/lib/internships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/internships/admin?schoolId=
// Lists all internship applications for the school (staff view). Requires
// internship.manage OR internship.view. 200
// { internships: [{ id, studentId, studentName, listingId, role, companyName,
//                   status, startDate, endDate, certificateNo }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const canManage = await userHasPermission(user, 'internship.manage');
        const canView = await userHasPermission(user, 'internship.view');
        if (!canManage && !canView) {
            throw requireInternshipView();
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const internships = await withClient(user, async (db) => {
            const rows = await db.internship.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { createdAt: 'desc' },
            });

            const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
            const students = studentIds.length
                ? await db.student.findMany({
                    where: { id: { in: studentIds } },
                    select: { id: true, firstName: true, lastName: true },
                })
                : [];
            const studentName = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));

            const listingIds = Array.from(new Set(rows.map((r) => r.listingId)));
            const listings = listingIds.length
                ? await db.internshipListing.findMany({ where: { id: { in: listingIds } } })
                : [];
            const listingMap = new Map(listings.map((l) => [l.id, l]));

            return rows.map((r) => {
                const listing = listingMap.get(r.listingId);
                return {
                    id: r.id,
                    studentId: r.studentId,
                    studentName: studentName.get(r.studentId) ?? 'Unknown student',
                    listingId: r.listingId,
                    role: listing?.role ?? 'Unknown role',
                    companyName: listing?.companyName ?? '',
                    status: r.status,
                    startDate: r.startDate ? r.startDate.toISOString() : null,
                    endDate: r.endDate ? r.endDate.toISOString() : null,
                    certificateNo: r.certificateNo,
                };
            });
        });

        return successResponse({ internships });
    } catch (error) {
        return errorResponse(error);
    }
});
