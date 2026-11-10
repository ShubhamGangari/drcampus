import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateCertificateSchema } from '@/lib/certificates-schemas';
import { userHasPermission, getNextSequence, canTransitionStatus, buildReferenceNo } from '@/lib/certificates-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/certificates/[id] — approve / reject / issue (certificates.manage).
// Body: { status: "APPROVED"|"REJECTED"|"ISSUED", remark? }. On ISSUED a
// referenceNo (CERT-<year>-<seq>) is assigned and issuedAt is set.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'certificates.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Certificates management permission required');
        }

        const body = await validateBody(request, updateCertificateSchema);
        const id = params.id;

        const certificate = await withClient(user, async (db) => {
            const existing = await db.certificate.findUnique({ where: { id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Certificate not found');
            }
            if (!canTransitionStatus(existing.status, body.status)) {
                throw new ApiError(
                    409,
                    'INVALID_TRANSITION',
                    `Cannot move certificate from ${existing.status} to ${body.status}`
                );
            }

            const data: {
                status: string;
                remark: string | null;
                referenceNo?: string;
                issuedAt?: Date;
            } = {
                status: body.status,
                remark: body.remark ?? existing.remark,
            };

            if (body.status === 'ISSUED') {
                const year = new Date().getFullYear();
                const prefix = `CERT-${year}-`;
                const seq = await getNextSequence(db, 'certificate', 'referenceNo', prefix, existing.schoolId);
                data.referenceNo = buildReferenceNo(seq, year);
                data.issuedAt = new Date();
            }

            return db.certificate.update({ where: { id }, data });
        });

        return successResponse({ certificate });
    } catch (error) {
        return errorResponse(error);
    }
});
