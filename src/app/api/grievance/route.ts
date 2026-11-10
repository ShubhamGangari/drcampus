import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse } from '@/lib/api';
import { createGrievanceSchema } from '@/lib/grievance-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    buildTicketNo,
} from '@/lib/grievance-core';
import { getNextSequence } from '@/lib/fee-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/grievance?status=&category=&mine=&schoolId=
// Any authenticated user may list tickets. Calling `mine=true` scopes the list
// to tickets the current user raised. 200 { tickets: [...] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const status = url.searchParams.get('status') ?? undefined;
        const category = url.searchParams.get('category') ?? undefined;
        const mine = url.searchParams.get('mine') === 'true';

        const tickets = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
            if (status) where.status = status;
            if (category) where.category = category;
            if (mine) where.requesterId = user.userId;

            const rows = await db.grievance.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    ticketNo: true,
                    category: true,
                    subject: true,
                    status: true,
                    priority: true,
                    requesterId: true,
                    assigneeUserId: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            return rows;
        });

        return successResponse({ tickets });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/grievance — raise a ticket (any authenticated user). 201 { ticket }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createGrievanceSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const ticket = await withClient(user, async (db) => {
            const year = new Date().getFullYear();
            const seq = await getNextSequence(db, 'grievance', 'ticketNo', `GRV-${year}-`, tenant);
            const ticketNo = buildTicketNo('', seq, year);

            return db.grievance.create({
                data: {
                    schoolId: tenant,
                    ticketNo,
                    requesterId: user.userId,
                    category: body.category,
                    subject: body.subject,
                    description: body.description,
                    priority: body.priority ?? 'MEDIUM',
                },
                select: {
                    id: true,
                    ticketNo: true,
                    category: true,
                    subject: true,
                    description: true,
                    status: true,
                    priority: true,
                    requesterId: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
        });

        return successResponse({ ticket }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
