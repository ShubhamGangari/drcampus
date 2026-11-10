import { prismaBase } from '@/lib/prisma';
import { successResponse, errorResponse, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/certificates/verify?code= — PUBLIC (no auth). Verifies an issued
// certificate by its referenceNo. Never exposes personal data beyond
// name/type/issue date.
// ---------------------------------------------------------------------------
export const GET = async (request: Request) => {
    try {
        const url = new URL(request.url);
        const code = url.searchParams.get('code')?.trim() || '';
        if (!code) {
            throw new ApiError(400, 'INVALID_CODE', 'Verification code is required');
        }

        const certificate = await prismaBase.certificate.findUnique({
            where: { referenceNo: code },
        });
        if (!certificate || certificate.status !== 'ISSUED') {
            throw new ApiError(404, 'NOT_FOUND', 'Certificate not found');
        }

        const student = await prismaBase.student.findUnique({
            where: { id: certificate.studentId },
            select: { firstName: true, lastName: true },
        });

        return successResponse({
            valid: true,
            type: certificate.type,
            studentName: student ? `${student.firstName} ${student.lastName}`.trim() : null,
            issuedDate: certificate.issuedAt,
            referenceNo: certificate.referenceNo,
        });
    } catch (error) {
        return errorResponse(error);
    }
};
