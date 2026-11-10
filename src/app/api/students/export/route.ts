import { withClient } from '@/lib/prisma';
import { withAuth, errorResponse, ApiError } from '@/lib/api';
import { buildExportPayload, type ExportFormat } from '@/lib/export-shared';
import type { ReportTable } from '@/lib/reports-center-core';

export const dynamic = 'force-dynamic';

const EXPORT_ROLES = ['REGISTRAR_ADMIN', 'SUPER_ADMIN'];

function requireExportFormat(url: URL): ExportFormat {
    const fmt = url.searchParams.get('fmt');
    if (fmt === 'pdf') return 'pdf';
    return 'csv'; // default
}

/**
 * GET /api/students/export?fmt=csv|pdf&programId&batchId&status&search
 * Renders the current student list (respecting the same filters as the page)
 * as CSV or a print-friendly HTML view for PDF. Registrar admin only.
 * 200 { filename, content, contentType }
 */
export const GET = withAuth(async (request, { user }) => {
    try {
        if (!EXPORT_ROLES.includes(user.role)) {
            throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
        }

        const url = new URL(request.url);
        const fmt = requireExportFormat(url);

        const programId = url.searchParams.get('programId') ?? undefined;
        const batchId = url.searchParams.get('batchId') ?? undefined;
        const status = url.searchParams.get('status') ?? undefined;
        const search = url.searchParams.get('search') ?? undefined;

        const result = await withClient(user, async (db) => {
            const where: Record<string, unknown> = {};
            if (programId) where.programId = programId;
            if (batchId) where.batchId = batchId;
            if (status) where.status = status;
            if (search) {
                where.OR = [
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                    { rollNo: { contains: search } },
                    { email: { contains: search } },
                ];
            }

            const students = await db.student.findMany({
                where,
                select: {
                    id: true,
                    rollNo: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    dob: true,
                    gender: true,
                    category: true,
                    status: true,
                    admissionDate: true,
                    programId: true,
                    batchId: true,
                    program: { select: { code: true, name: true } },
                    batch: { select: { name: true } },
                },
                orderBy: [{ programId: 'asc' }, { rollNo: 'asc' }],
            });

            const table: ReportTable = {
                columns: [
                    'Roll No',
                    'First Name',
                    'Last Name',
                    'Email',
                    'Phone',
                    'Program Code',
                    'Program Name',
                    'Batch',
                    'Status',
                    'Admission Date',
                    'DOB',
                    'Gender',
                    'Category',
                ],
                rows: students.map((s) => ({
                    'Roll No': s.rollNo,
                    'First Name': s.firstName,
                    'Last Name': s.lastName,
                    Email: s.email,
                    Phone: s.phone,
                    'Program Code': s.program?.code ?? s.programId,
                    'Program Name': s.program?.name ?? '',
                    Batch: s.batch?.name ?? s.batchId,
                    Status: s.status,
                    'Admission Date': s.admissionDate ? s.admissionDate.toISOString().slice(0, 10) : '',
                    DOB: s.dob ? s.dob.slice(0, 10) : '',
                    Gender: s.gender,
                    Category: s.category,
                })),
            };

            return table;
        });

        return buildExportPayload(result, fmt, 'students');
    } catch (error) {
        return errorResponse(error);
    }
});
