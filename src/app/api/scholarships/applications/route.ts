import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createApplicationSchema } from '@/lib/scholarships-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    findSelfStudent,
    userHasPermission,
    evaluateEligibility,
} from '@/lib/scholarships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/scholarships/applications?status=&schoolId=
// Students see only their own applications; scholarships.view/manage users see all.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const status = url.searchParams.get('status') ?? undefined;

        const applications = await withClient(user, async (db) => {
            const canViewAll =
                (await userHasPermission(user, 'scholarships.view')) ||
                (await userHasPermission(user, 'scholarships.manage'));
            const where: Record<string, unknown> = {};

            if (canViewAll) {
                Object.assign(where, tenantFilter(isCentralUser(user), schoolId));
            } else {
                const self = await findSelfStudent(db, user);
                if (!self) {
                    throw new ApiError(400, 'STUDENT_REQUIRED', 'No student profile linked to this account');
                }
                where.studentId = self.id;
            }
            if (status) {
                where.status = status;
            }

            const rows = await db.scholarshipApplication.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: { scheme: { select: { name: true } } },
            });
            return rows.map((a) => ({
                id: a.id,
                studentId: a.studentId,
                schemeId: a.schemeId,
                schemeName: a.scheme.name,
                status: a.status,
                eligible: a.eligible,
                awardedAmount: a.awardedAmount,
                remark: a.remark,
                createdAt: a.createdAt,
            }));
        });

        return successResponse({ applications });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/scholarships/applications — apply (self) for a scheme.
// Auto-evaluates eligibility; never auto-approves. 201 { application }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createApplicationSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const application = await withClient(user, async (db) => {
            const student = await findSelfStudent(db, user);
            if (!student) {
                throw new ApiError(400, 'STUDENT_REQUIRED', 'Only students can apply for scholarships');
            }

            const scheme = await db.scholarshipScheme.findUnique({ where: { id: body.schemeId } });
            if (!scheme) {
                throw new ApiError(404, 'NOT_FOUND', 'Scheme not found');
            }
            if (scheme.schoolId !== tenant) {
                throw new ApiError(400, 'SCHOOL_MISMATCH', 'Scheme does not belong to this school');
            }

            const duplicate = await db.scholarshipApplication.findFirst({
                where: { studentId: student.id, schemeId: scheme.id },
            });
            if (duplicate) {
                throw new ApiError(409, 'DUPLICATE_APPLICATION', 'Already applied to this scheme');
            }

            const result = evaluateEligibility(
                { category: student.category, aggregatePercentage: undefined, sports: undefined },
                scheme
            );

            const created = await db.scholarshipApplication.create({
                data: {
                    schoolId: tenant,
                    studentId: student.id,
                    schemeId: scheme.id,
                    eligible: result.eligible,
                    notes: body.notes ?? null,
                },
            });
            return {
                id: created.id,
                studentId: created.studentId,
                schemeId: created.schemeId,
                schemeName: scheme.name,
                status: created.status,
                eligible: created.eligible,
                awardedAmount: created.awardedAmount,
                notes: created.notes,
                createdAt: created.createdAt,
            };
        });

        return successResponse({ application }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
