import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createPassSchema } from '@/lib/transport-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    userHasPermission,
    assertStudentBelongsToSchool,
    findSelfStudent,
    assertRouteBelongsToSchool,
    computePassValidity,
    PASS_STATUS,
    parseStops,
} from '@/lib/transport-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/transport/passes?studentId=&schoolId= → 200 { passes }
// transport.view/manage see all; students see only their own pass.
// Pass status is recomputed on read (ACTIVE → EXPIRED after validTo).
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const studentId = url.searchParams.get('studentId') ?? undefined;

        const canViewAll = (await userHasPermission(user, 'transport.view')) ||
            (await userHasPermission(user, 'transport.manage'));

        const passes = await withClient(user, async (db) => {
            const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);

            if (!canViewAll) {
                const self = await findSelfStudent(db, user);
                if (!self) return [];
                where.studentId = self.id;
            } else if (studentId) {
                where.studentId = studentId;
            }

            const rows = await db.transportPass.findMany({
                where,
                orderBy: { validFrom: 'desc' },
                include: { route: { select: { name: true, stopsJson: true } } },
            });

            const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
            const students = studentIds.length
                ? await db.student.findMany({
                    where: { id: { in: studentIds } },
                    select: { id: true, firstName: true, lastName: true, rollNo: true },
                })
                : [];
            const studentById = new Map(students.map((s) => [s.id, s]));

            return rows.map((r) => {
                const student = studentById.get(r.studentId);
                const name = student ? `${student.firstName} ${student.lastName}`.trim() : 'Unknown';
                const stops = parseStops(r.route.stopsJson);
                return {
                    id: r.id,
                    studentId: r.studentId,
                    studentName: name,
                    rollNo: student?.rollNo ?? null,
                    routeId: r.routeId,
                    routeName: r.route.name,
                    routeStops: stops.sort((a, b) => a.order - b.order),
                    stop: r.stop,
                    validFrom: r.validFrom.toISOString(),
                    validTo: r.validTo.toISOString(),
                    fee: r.fee,
                    status: computePassValidity(r, new Date()),
                };
            });
        });

        return successResponse({ passes });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/transport/passes (transport.manage, issue) → 201 { pass }
// Issuing to a student with an ACTIVE pass → 409 (renew instead).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'transport.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Transport management permission required');
        }

        const body = await validateBody(request, createPassSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const pass = await withClient(user, async (db) => {
            await assertStudentBelongsToSchool(db, body.studentId, tenant);
            await assertRouteBelongsToSchool(db, body.routeId, tenant);

            const activePass = await db.transportPass.findFirst({
                where: { studentId: body.studentId, status: PASS_STATUS.ACTIVE },
            });
            if (activePass) {
                throw new ApiError(
                    409,
                    'ACTIVE_PASS_EXISTS',
                    'Student already has an active pass — renew it instead'
                );
            }

            const created = await db.transportPass.create({
                data: {
                    schoolId: tenant,
                    studentId: body.studentId,
                    routeId: body.routeId,
                    stop: body.stop,
                    validTo: new Date(body.validTo),
                    fee: body.fee,
                    status: PASS_STATUS.ACTIVE,
                },
                include: { route: { select: { name: true } } },
            });

            return {
                id: created.id,
                studentId: created.studentId,
                studentName: 'Unknown',
                rollNo: null,
                routeId: created.routeId,
                routeName: created.route.name,
                routeStops: [],
                stop: created.stop,
                validFrom: created.validFrom.toISOString(),
                validTo: created.validTo.toISOString(),
                fee: created.fee,
                status: PASS_STATUS.ACTIVE,
            };
        });

        return successResponse({ pass }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
