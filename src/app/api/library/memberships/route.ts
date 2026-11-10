import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createMembershipSchema } from '@/lib/library-schemas';
import { tenantFilter, userHasPermission, resolveCreateTenant } from '@/lib/library-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/library/memberships?schoolId=  (library.view | library.manage)
//   200 { memberships: [{ id, userId, name, email, type, active, outstandingFine }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const canView = (await userHasPermission(user, 'library.view')) ||
            (await userHasPermission(user, 'library.manage'));
        if (!canView) {
            throw new ApiError(403, 'FORBIDDEN', 'Library view permission required');
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const memberships = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            const rows = await db.libraryMembership.findMany({
                where,
                orderBy: { userId: 'asc' },
            });

            const userIds = Array.from(new Set(rows.map((r) => r.userId)));
            const users = userIds.length
                ? await db.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, name: true, email: true },
                })
                : [];
            const userById = new Map(users.map((u) => [u.id, u]));

            const result = [];
            for (const m of rows) {
                // Outstanding fines = sum of unpaid fines on this membership's loans.
                const agg = await db.libraryLoan.aggregate({
                    where: { memberId: m.id, fineStatus: 'UNPAID' },
                    _sum: { fine: true },
                });
                const u = userById.get(m.userId);
                result.push({
                    id: m.id,
                    userId: m.userId,
                    name: u?.name ?? 'Unknown',
                    email: u?.email ?? '',
                    type: m.type,
                    active: m.active,
                    outstandingFine: agg._sum.fine ?? 0,
                });
            }
            return result;
        });

        return successResponse({ memberships });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/library/memberships — create a membership (library.manage). 201 { membership }
// Body `{ userId, type? }`. Fails if the user already has a membership.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library management permission required');
        }

        const body = await validateBody(request, createMembershipSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const membership = await withClient(user, async (db) => {
            const memberUser = await db.user.findUnique({ where: { id: body.userId } });
            if (!memberUser) {
                throw new ApiError(400, 'MEMBER_NOT_FOUND', 'Member user not found');
            }

            const existing = await db.libraryMembership.findFirst({
                where: { userId: body.userId, schoolId: tenant },
            });
            if (existing) {
                throw new ApiError(409, 'MEMBERSHIP_EXISTS', 'User already has a library membership');
            }

            const created = await db.libraryMembership.create({
                data: {
                    userId: body.userId,
                    schoolId: tenant,
                    type: body.type,
                    active: true,
                },
            });

            return {
                id: created.id,
                userId: created.userId,
                name: memberUser.name,
                email: memberUser.email,
                type: created.type,
                active: created.active,
            };
        });

        return successResponse({ membership }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
