import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createBroadcastSchema } from '@/lib/transport-schemas';
import { resolveCreateTenant, tenantFilter, userHasPermission } from '@/lib/transport-core';

export const dynamic = 'force-dynamic';

const NOTIFICATION_TYPE = 'transport_broadcast';

// ---------------------------------------------------------------------------
// GET /api/transport/broadcasts?schoolId=&routeId=&activeOnly=
// 200 { broadcasts: [...] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const routeId = url.searchParams.get('routeId') ?? undefined;
        const activeOnly = url.searchParams.get('activeOnly') === 'true';

        const broadcasts = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            if (routeId) {
                where.routeId = routeId;
            }
            if (activeOnly) {
                where.active = true;
            }

            const rows = await db.transportBroadcast.findMany({
                where,
                include: {
                    route: {
                        select: { id: true, name: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });

            return rows.map((b) => ({
                id: b.id,
                schoolId: b.schoolId,
                routeId: b.routeId,
                routeName: b.route?.name ?? 'All Routes',
                vehicleNo: b.vehicleNo,
                type: b.type,
                title: b.title,
                message: b.message,
                delayMin: b.delayMin,
                postedBy: b.postedBy,
                active: b.active,
                createdAt: b.createdAt.toISOString(),
                updatedAt: b.updatedAt.toISOString(),
            }));
        });

        return successResponse({ broadcasts });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/transport/broadcasts (Staff / Driver / Admin)
// Body: { schoolId?, routeId?, vehicleNo?, type, title, message, delayMin?, postedBy? }
// 201 { broadcast, notifiedStudentsCount }
//
// Automatically dispatches in-app Notifications to all students with an
// active TransportPass on the targeted route so they are alerted immediately.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const hasPerm = await userHasPermission(user, 'transport.manage');
        const allowedRoles = ['SUPER_ADMIN', 'REGISTRAR_ADMIN', 'DEAN', 'FACULTY'];
        if (!hasPerm && !allowedRoles.includes(user.role)) {
            throw new ApiError(403, 'FORBIDDEN', 'Permission required to post transport broadcasts');
        }

        const body = await validateBody(request, createBroadcastSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const result = await withClient(user, async (db) => {
            const author = body.postedBy || user.name || user.email || 'Transport Office';

            // 1. Create Broadcast
            const broadcast = await db.transportBroadcast.create({
                data: {
                    schoolId: tenant,
                    routeId: body.routeId || null,
                    vehicleNo: body.vehicleNo || null,
                    type: body.type,
                    title: body.title,
                    message: body.message,
                    delayMin: body.delayMin || null,
                    postedBy: author,
                    active: true,
                },
                include: {
                    route: {
                        select: { id: true, name: true },
                    },
                },
            });

            // 2. Resolve target students holding an active TransportPass
            const passWhere: Record<string, unknown> = {
                schoolId: tenant,
                status: 'ACTIVE',
            };
            if (body.routeId) {
                passWhere.routeId = body.routeId;
            }

            const activePasses = await db.transportPass.findMany({
                where: passWhere,
                select: { studentId: true },
            });

            const studentIds = Array.from(new Set(activePasses.map((p) => p.studentId)));
            let notifiedCount = 0;

            if (studentIds.length > 0) {
                // Find user accounts for these students via email match
                const students = await db.student.findMany({
                    where: { id: { in: studentIds } },
                    select: { id: true, email: true },
                });

                const emails = students.map((s) => s.email).filter(Boolean);
                if (emails.length > 0) {
                    const recipientUsers = await db.user.findMany({
                        where: { email: { in: emails } },
                        select: { id: true },
                    });

                    const notifTitle = `🚨 Bus Notice: ${body.title}`;
                    const notifBody = `${
                        body.delayMin ? `[Delay: +${body.delayMin} min] ` : ''
                    }${body.message} (Route: ${broadcast.route?.name ?? 'All Routes'})`;

                    await db.$transaction(async (tx) => {
                        for (const u of recipientUsers) {
                            await tx.notification.create({
                                data: {
                                    schoolId: tenant,
                                    recipientUserId: u.id,
                                    type: NOTIFICATION_TYPE,
                                    title: notifTitle,
                                    body: notifBody,
                                    link: '/transport/broadcasts',
                                },
                            });
                            notifiedCount++;
                        }
                    });
                }
            }

            return {
                broadcast: {
                    id: broadcast.id,
                    schoolId: broadcast.schoolId,
                    routeId: broadcast.routeId,
                    routeName: broadcast.route?.name ?? 'All Routes',
                    vehicleNo: broadcast.vehicleNo,
                    type: broadcast.type,
                    title: broadcast.title,
                    message: broadcast.message,
                    delayMin: broadcast.delayMin,
                    postedBy: broadcast.postedBy,
                    active: broadcast.active,
                    createdAt: broadcast.createdAt.toISOString(),
                },
                notifiedCount,
            };
        });

        return successResponse(result, 201);
    } catch (error) {
        return errorResponse(error);
    }
});

