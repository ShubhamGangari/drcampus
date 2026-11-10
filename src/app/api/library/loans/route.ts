import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { issueLoanSchema } from '@/lib/library-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    LIBRARY_DEFAULT_LOAN_DAYS,
    LOAN_STATUS,
} from '@/lib/library-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/library/loans?memberId=&status=&schoolId=
// Librarians (library.manage/view) see all loans; students see only their own.
// 200 { loans: [{ id, copyId, bookTitle, memberId, memberName, issueDate,
//                 dueDate, returnDate, status, fine }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const memberId = url.searchParams.get('memberId') ?? undefined;
        const status = url.searchParams.get('status') ?? undefined;

        const canViewAll = await userHasPermission(user, 'library.view') ||
            (await userHasPermission(user, 'library.manage'));

        const loans = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);

            if (!canViewAll) {
                // Self-service: only loans for this user's own membership.
                const myMembership = await db.libraryMembership.findFirst({
                    where: { userId: user.userId },
                    select: { id: true },
                });
                if (!myMembership) return [];
                where.memberId = myMembership.id;
            } else {
                if (memberId) where.memberId = memberId;
                if (status) where.status = status;
            }

            const rows = await db.libraryLoan.findMany({
                where,
                orderBy: { issueDate: 'desc' },
                include: {
                    copy: { include: { book: { select: { title: true } } } },
                    membership: { select: { userId: true } },
                },
            });

            // Resolve member names from the User table (id -> name).
            const userIds = Array.from(new Set(rows.map((r) => r.membership.userId)));
            const users = userIds.length
                ? await db.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, name: true },
                })
                : [];
            const nameById = new Map(users.map((u) => [u.id, u.name]));

            return rows.map((r) => ({
                id: r.id,
                copyId: r.copyId,
                bookTitle: r.copy.book.title,
                memberId: r.membership.userId,
                memberName: nameById.get(r.membership.userId) ?? 'Unknown',
                issueDate: r.issueDate.toISOString(),
                dueDate: r.dueDate.toISOString(),
                returnDate: r.returnDate ? r.returnDate.toISOString() : null,
                status: r.status,
                fine: r.fine,
                fineStatus: r.fineStatus,
            }));
        });

        return successResponse({ loans });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/library/loans — issue a copy (library.manage). 201 { loan }
// Auto-provisions a STUDENT membership on first issue. Rejects an already-issued
// copy (409) or a deactivated/non-member (400). 14-day default due date.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library management permission required');
        }

        const body = await validateBody(request, issueLoanSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const loan = await withClient(user, async (db) => {
            // The member must be a real user and must have an active membership.
            const memberUser = await db.user.findUnique({ where: { id: body.memberId } });
            if (!memberUser) {
                throw new ApiError(400, 'MEMBER_NOT_FOUND', 'Member user not found');
            }

            // Auto-provision a STUDENT membership on first issue.
            let membership = await db.libraryMembership.findFirst({
                where: { userId: body.memberId, schoolId: tenant },
            });
            if (!membership) {
                membership = await db.libraryMembership.create({
                    data: { userId: body.memberId, schoolId: tenant, type: 'STUDENT', active: true },
                });
            } else if (!membership.active) {
                throw new ApiError(400, 'MEMBER_INACTIVE', 'Member membership is deactivated');
            }

            // The copy must exist, belong to this school, and be available.
            const copy = await db.libraryCopy.findUnique({ where: { id: body.copyId } });
            if (!copy || copy.schoolId !== tenant) {
                throw new ApiError(404, 'NOT_FOUND', 'Copy not found');
            }
            if (!copy.available) {
                throw new ApiError(409, 'COPY_ISSUED', 'This copy is already issued');
            }

            const dueDate = body.dueDate
                ? new Date(body.dueDate)
                : new Date(Date.now() + LIBRARY_DEFAULT_LOAN_DAYS * 86400000);

            const created = await db.libraryLoan.create({
                data: {
                    copyId: copy.id,
                    memberId: membership.id,
                    dueDate,
                    schoolId: tenant,
                    status: LOAN_STATUS.ISSUED,
                },
            });

            // Mark the copy unavailable.
            await db.libraryCopy.update({
                where: { id: copy.id },
                data: { available: false },
            });

            return {
                id: created.id,
                copyId: created.copyId,
                memberId: memberUser.id,
                issueDate: created.issueDate.toISOString(),
                dueDate: created.dueDate.toISOString(),
                returnDate: null,
                status: LOAN_STATUS.ISSUED,
                fine: 0,
                fineStatus: 'UNPAID',
            };
        });

        return successResponse({ loan }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
