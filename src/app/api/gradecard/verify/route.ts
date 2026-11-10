import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { tenantFilter } from '@/lib/gradecard-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/gradecard/verify?transcriptNo=
// Public, limited-field verification of a transcript. Returns only public
// identity/academic fields — never email, phone or DOB. 200 { transcript }
// Unknown transcript numbers return 404.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const transcriptNo = url.searchParams.get('transcriptNo');
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        if (!transcriptNo) {
            return errorResponse(new ApiError(400, 'BAD_REQUEST', 'transcriptNo is required'));
        }

        const transcript = await withClient(user, async (db) => {
            const row = await db.transcript.findFirst({
                where: { ...tenantFilter(isCentralUser(user), schoolId), transcriptNo },
                select: { studentId: true, transcriptNo: true, type: true, cgpa: true, sgpa: true, issuedAt: true },
            });
            if (!row) {
                throw new ApiError(404, 'NOT_FOUND', 'Transcript not found');
            }

            const student = await db.student.findUnique({
                where: { id: row.studentId },
                select: { firstName: true, lastName: true, programId: true },
            });

            let program: string | null = null;
            if (student?.programId) {
                const p = await db.program.findUnique({
                    where: { id: student.programId },
                    select: { name: true },
                });
                program = p?.name ?? null;
            }

            const result = row.cgpa != null && row.cgpa > 0 ? 'PASS' : 'PENDING';

            return {
                transcriptNo: row.transcriptNo,
                name: student ? `${student.firstName} ${student.lastName}`.trim() : null,
                program,
                type: row.type,
                result,
                cgpa: row.cgpa,
                sgpa: row.sgpa,
                issuedAt: row.issuedAt.toISOString(),
            };
        });

        return successResponse({ transcript });
    } catch (error) {
        return errorResponse(error);
    }
});
