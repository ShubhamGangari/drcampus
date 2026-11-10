import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse } from '@/lib/api';
import { createClubSchema } from '@/lib/clubs-schemas';
import { resolveCreateTenant, tenantFilter, userHasPermission, requireClubsManage, findSelfStudent } from '@/lib/clubs-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/clubs?category=&schoolId=
// 200 { clubs: [{ id, name, category, description, coordinatorName, memberCount }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const category = url.searchParams.get('category') ?? undefined;

        const clubs = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            if (category) {
                where.category = category;
            }

            const rows = await db.club.findMany({
                where,
                orderBy: { name: 'asc' },
                include: { _count: { select: { members: true } } },
            });

            // Whether the current user (if a student) is a member of each club.
            let memberClubIds: string[] = [];
            try {
                const self = await findSelfStudent(db, user);
                if (self) {
                    const mems = await db.clubMembership.findMany({
                        where: { studentId: self.id },
                        select: { clubId: true },
                    });
                    memberClubIds = mems.map((m) => m.clubId);
                }
            } catch {
                // non-student users have no memberships
            }
            const memberSet = new Set(memberClubIds);

            const coordinatorIds = rows.reduce<string[]>((acc, c) => {
                if (c.coordinatorUserId && !acc.includes(c.coordinatorUserId)) acc.push(c.coordinatorUserId);
                return acc;
            }, []);
            const coordinators = await db.user.findMany({
                where: { id: { in: coordinatorIds } },
                select: { id: true, name: true },
            });
            const coordMap = new Map(coordinators.map((u) => [u.id, u.name]));

            return rows.map((c) => ({
                id: c.id,
                name: c.name,
                category: c.category,
                description: c.description,
                coordinatorName: c.coordinatorUserId ? (coordMap.get(c.coordinatorUserId) ?? null) : null,
                memberCount: c._count.members,
                joined: memberSet.has(c.id),
            }));
        });

        return successResponse({ clubs });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/clubs — create a club (clubs.manage). Coordinator (if provided) is
// auto-added as a member with role COORDINATOR. 201 { club }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'clubs.manage'))) {
            throw requireClubsManage();
        }

        const body = await validateBody(request, createClubSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const club = await withClient(user, async (db) => {
            const created = await db.club.create({
                data: {
                    schoolId: tenant,
                    name: body.name,
                    category: body.category,
                    description: body.description ?? null,
                    coordinatorUserId: body.coordinatorUserId ?? null,
                },
            });

            if (body.coordinatorUserId) {
                await db.clubMembership.create({
                    data: {
                        clubId: created.id,
                        studentId: body.coordinatorUserId,
                        role: 'COORDINATOR',
                    },
                });
            }

            return created;
        });

        return successResponse({ club }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
