import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { updateListingSchema } from '@/lib/internships-schemas';
import {
    tenantFilter,
    userHasPermission,
    requireInternshipManage,
} from '@/lib/internships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/internships/listings/[id] — update a listing (internship.manage).
// 200 { listing }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'internship.manage'))) {
            throw requireInternshipManage();
        }

        const body = await validateBody(request, updateListingSchema);

        const listing = await withClient(user, async (db) => {
            const existing = await db.internshipListing.findFirst({
                where: { ...tenantFilter(isCentralUser(user), user.schoolId === 'ALL' ? undefined : user.schoolId), id: params.id },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Internship listing not found');
            }

            const updated = await db.internshipListing.update({
                where: { id: existing.id },
                data: {
                    role: body.role,
                    companyName: body.companyName,
                    mode: body.mode,
                    duration: body.duration,
                    stipend: body.stipend !== undefined ? body.stipend : undefined,
                    deadline: body.deadline !== undefined ? (body.deadline ? new Date(body.deadline) : null) : undefined,
                    description: body.description !== undefined ? body.description : undefined,
                },
            });
            return {
                id: updated.id,
                role: updated.role,
                companyName: updated.companyName,
                mode: updated.mode,
                duration: updated.duration,
                stipend: updated.stipend,
                deadline: updated.deadline ? updated.deadline.toISOString() : null,
                description: updated.description,
            };
        });

        return successResponse({ listing });
    } catch (error) {
        return errorResponse(error);
    }
});
