import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { createInternshipApplicationSchema } from '@/lib/internships-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    findSelfStudent,
} from '@/lib/internships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/internships/my?schoolId=
// Lists the current student's internship applications. 200
// { internships: [{ id, listingId, role, companyName, status, appliedAt }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const internships = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const rows = await db.internship.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    studentId: self.id,
                },
                orderBy: { createdAt: 'desc' },
            });

            const listingIds = Array.from(new Set(rows.map((r) => r.listingId)));
            const listings = listingIds.length
                ? await db.internshipListing.findMany({ where: { id: { in: listingIds } } })
                : [];
            const listingMap = new Map(listings.map((l) => [l.id, l]));

            return rows.map((r) => {
                const listing = listingMap.get(r.listingId);
                return {
                    id: r.id,
                    listingId: r.listingId,
                    role: listing?.role ?? 'Unknown role',
                    companyName: listing?.companyName ?? '',
                    status: r.status,
                    appliedAt: r.createdAt.toISOString(),
                };
            });
        });

        return successResponse({ internships });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/internships/my — self-service apply to a listing. 201 { internship }
// Dedupe guard → 409 DUPLICATE_APPLICATION.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createInternshipApplicationSchema);

        const internship = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const tenant = resolveCreateTenant(user, body.schoolId);

            const listing = await db.internshipListing.findFirst({
                where: { ...tenantFilter(isCentralUser(user), tenant), id: body.listingId },
            });
            if (!listing) {
                throw new ApiError(404, 'LISTING_NOT_FOUND', 'Internship listing not found');
            }

            const existing = await db.internship.findFirst({
                where: { schoolId: tenant, listingId: body.listingId, studentId: self.id },
            });
            if (existing) {
                throw new ApiError(409, 'DUPLICATE_APPLICATION', 'You have already applied to this listing');
            }

            const created = await db.internship.create({
                data: {
                    schoolId: tenant,
                    listingId: body.listingId,
                    studentId: self.id,
                    status: 'APPLIED',
                },
            });

            return {
                id: created.id,
                listingId: created.listingId,
                role: listing.role,
                companyName: listing.companyName,
                status: created.status,
                appliedAt: created.createdAt.toISOString(),
            };
        });

        return successResponse({ internship }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
