import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
} from '@/lib/api';
import { createListingSchema } from '@/lib/internships-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    requireInternshipManage,
} from '@/lib/internships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/internships/listings?schoolId=
// Lists internship listings. Read-only, self-service. 200
// { listings: [{ id, role, companyName, mode, duration, stipend, deadline,
//                description }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const listings = await withClient(user, async (db) => {
            const rows = await db.internshipListing.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { createdAt: 'desc' },
            });
            return rows.map((l) => ({
                id: l.id,
                role: l.role,
                companyName: l.companyName,
                mode: l.mode,
                duration: l.duration,
                stipend: l.stipend,
                deadline: l.deadline ? l.deadline.toISOString() : null,
                description: l.description,
            }));
        });

        return successResponse({ listings });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/internships/listings — create a listing (internship.manage). 201 { listing }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'internship.manage'))) {
            throw requireInternshipManage();
        }

        const body = await validateBody(request, createListingSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const listing = await withClient(user, async (db) => {
            const created = await db.internshipListing.create({
                data: {
                    schoolId: tenant,
                    role: body.role,
                    companyName: body.companyName,
                    mode: body.mode,
                    duration: body.duration,
                    stipend: body.stipend ?? null,
                    deadline: body.deadline ? new Date(body.deadline) : null,
                    description: body.description ?? null,
                },
            });
            return {
                id: created.id,
                role: created.role,
                companyName: created.companyName,
                mode: created.mode,
                duration: created.duration,
                stipend: created.stipend,
                deadline: created.deadline ? created.deadline.toISOString() : null,
                description: created.description,
            };
        });

        return successResponse({ listing }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
