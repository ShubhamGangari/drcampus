import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { updateInternshipStatusSchema } from '@/lib/internships-schemas';
import {
    tenantFilter,
    userHasPermission,
    requireInternshipManage,
    canTransitionInternshipStatus,
    INTERNSHIP_STATUS,
} from '@/lib/internships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/internships/admin/[id] — update a student's internship status
// (internship.manage). Validates transition via canTransitionInternshipStatus.
// Completing requires a certificateNo (else 400). 200 { internship }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'internship.manage'))) {
            throw requireInternshipManage();
        }

        const body = await validateBody(request, updateInternshipStatusSchema);

        const internship = await withClient(user, async (db) => {
            const existing = await db.internship.findFirst({
                where: { ...tenantFilter(isCentralUser(user), user.schoolId === 'ALL' ? undefined : user.schoolId), id: params.id },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Internship record not found');
            }

            if (body.status === INTERNSHIP_STATUS.COMPLETED && !body.certificateNo) {
                throw new ApiError(400, 'CERTIFICATE_REQUIRED', 'A certificate number is required to mark an internship completed');
            }

            if (!canTransitionInternshipStatus(existing.status, body.status)) {
                throw new ApiError(400, 'INVALID_STATUS_TRANSITION', `Cannot transition from ${existing.status} to ${body.status}`);
            }

            const updated = await db.internship.update({
                where: { id: existing.id },
                data: {
                    status: body.status,
                    startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
                    endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
                    certificateNo: body.certificateNo !== undefined ? body.certificateNo : undefined,
                },
            });

            const student = await db.student.findUnique({
                where: { id: updated.studentId },
                select: { id: true, firstName: true, lastName: true },
            });
            const listing = await db.internshipListing.findUnique({
                where: { id: updated.listingId },
            });

            return {
                id: updated.id,
                studentId: updated.studentId,
                studentName: student ? `${student.firstName} ${student.lastName}`.trim() : 'Unknown student',
                listingId: updated.listingId,
                role: listing?.role ?? 'Unknown role',
                companyName: listing?.companyName ?? '',
                status: updated.status,
                startDate: updated.startDate ? updated.startDate.toISOString() : null,
                endDate: updated.endDate ? updated.endDate.toISOString() : null,
                certificateNo: updated.certificateNo,
            };
        });

        return successResponse({ internship });
    } catch (error) {
        return errorResponse(error);
    }
});
