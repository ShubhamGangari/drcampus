import { withClient, isCentralUser, type Db } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createCertificateSchema, CERTIFICATE_TYPES } from '@/lib/certificates-schemas';
import {
    findSelfStudent,
    getNextSequence,
    tenantFilter,
    userHasPermission,
    buildRequestNo,
    requiresActiveStudent,
    requiresGraduatedStudent,
} from '@/lib/certificates-core';
import { STUDENT_STATUSES } from '@/lib/student-lifecycle';

export const dynamic = 'force-dynamic';

/**
 * Attaches the student's display name + roll number to each certificate row so
 * admin screens can render the queue without a second round-trip per row.
 */
async function enrichCertificates(
    db: Db,
    rows: Array<{ studentId: string;[key: string]: unknown }>
): Promise<Array<{ [key: string]: unknown }>> {
    if (!rows.length) return [];
    const ids = Array.from(new Set(rows.map((r) => r.studentId)));
    const students = await db.student.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true, rollNo: true },
    });
    const byId = new Map(students.map((s) => [s.id, s]));
    return rows.map((r) => {
        const s = byId.get(r.studentId);
        return {
            ...r,
            studentName: s ? `${s.firstName} ${s.lastName}`.trim() : null,
            studentRollNo: s?.rollNo ?? null,
        };
    });
}

// ---------------------------------------------------------------------------
// GET /api/certificates?status=&schoolId=&all=true
//   Self (default): the requesting student's own certificate requests.
//   ?all=true (certificates.manage/view): the whole queue within the tenant.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const all = url.searchParams.get('all') === 'true';
        const status = url.searchParams.get('status')?.trim() || undefined;
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const rows = await withClient(user, async (db) => {
            if (all) {
                const canView =
                    (await userHasPermission(user, 'certificates.manage')) ||
                    (await userHasPermission(user, 'certificates.view'));
                if (!canView) {
                    throw new ApiError(403, 'FORBIDDEN', 'Certificates view permission required');
                }
                const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);
                if (status) where.status = status;
                const found = await db.certificate.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                });
                return enrichCertificates(db, found as Array<{ studentId: string;[key: string]: unknown }>);
            }

            const student = await findSelfStudent(db, user);
            if (!student) return [];
            const where: Record<string, unknown> = { studentId: student.id };
            if (status) where.status = status;
            const found = await db.certificate.findMany({
                where,
                orderBy: { createdAt: 'desc' },
            });
            return enrichCertificates(db, found as Array<{ studentId: string;[key: string]: unknown }>);
        });

        return successResponse({ certificates: rows });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/certificates — student/alumni self-request. 201 { certificate }.
// Body: { type, purpose? }. Eligibility is enforced per type: Bonafide needs
// an active student; TC/Migration need a graduated/withdrawn student.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, createCertificateSchema);

        const certificate = await withClient(user, async (db) => {
            const student = await findSelfStudent(db, user);
            if (!student) {
                throw new ApiError(403, 'FORBIDDEN', 'Only students can request certificates');
            }

            if (requiresActiveStudent(body.type) && student.status !== STUDENT_STATUSES[0]) {
                throw new ApiError(
                    409,
                    'ELIGIBILITY',
                    'Bonafide certificate requires an active student record'
                );
            }
            if (requiresGraduatedStudent(body.type) && student.status === STUDENT_STATUSES[0]) {
                throw new ApiError(
                    409,
                    'ELIGIBILITY',
                    'TC/Migration certificate requires a graduated or withdrawn student'
                );
            }

            const schoolId = student.schoolId;
            const year = new Date().getFullYear();
            const prefix = `REQ-${year}-`;
            const seq = await getNextSequence(db, 'certificate', 'requestNo', prefix, schoolId);

            const created = await db.certificate.create({
                data: {
                    schoolId,
                    studentId: student.id,
                    type: body.type as (typeof CERTIFICATE_TYPES)[number],
                    purpose: body.purpose ?? null,
                    status: 'PENDING',
                    requestNo: buildRequestNo(seq, year),
                },
            });

            return {
                id: created.id,
                type: created.type,
                status: created.status,
                requestNo: created.requestNo,
            };
        });

        return successResponse({ certificate }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
