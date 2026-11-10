import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateApplicationSchema } from '@/lib/scholarships-schemas';
import { userHasPermission, requireScholarshipsManage, computeAward } from '@/lib/scholarships-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/scholarships/applications/[id] — review an application (manage)
// Approving computes the awarded amount; rejecting requires a remark.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'scholarships.manage'))) {
            throw requireScholarshipsManage();
        }

        const id = params.id;
        const body = await validateBody(request, updateApplicationSchema);

        const application = await withClient(user, async (db) => {
            const existing = await db.scholarshipApplication.findUnique({
                where: { id },
                include: { scheme: true },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Application not found');
            }

            if (body.status === 'REJECTED' && !(body.remark?.trim())) {
                throw new ApiError(400, 'REMARK_REQUIRED', 'Rejection requires a remark');
            }

            let awardedAmount = existing.awardedAmount;
            if (body.status === 'APPROVED') {
                const student = await db.student.findUnique({
                    where: { id: existing.studentId },
                    select: { programId: true },
                });
                let tuitionFee = 0;
                if (student) {
                    const feeStructure = await db.feeStructure.findFirst({
                        where: { schoolId: existing.schoolId, programId: student.programId },
                        orderBy: { createdAt: 'desc' },
                        select: { totalAmount: true },
                    });
                    tuitionFee = feeStructure?.totalAmount ?? 0;
                }
                awardedAmount = computeAward(existing.scheme, tuitionFee);
            }

            const updated = await db.scholarshipApplication.update({
                where: { id },
                data: {
                    status: body.status,
                    remark: body.remark ?? null,
                    awardedAmount,
                },
            });
            return {
                id: updated.id,
                studentId: updated.studentId,
                schemeId: updated.schemeId,
                schemeName: existing.scheme.name,
                status: updated.status,
                eligible: updated.eligible,
                awardedAmount: updated.awardedAmount,
                remark: updated.remark,
                createdAt: updated.createdAt,
            };
        });

        return successResponse({ application });
    } catch (error) {
        return errorResponse(error);
    }
});
