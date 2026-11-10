import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { generateRollNo, resolveCreateTenant } from '@/lib/student-lifecycle';
import { writeAuditLog } from '@/lib/audit-writer';
import {
    parseCsv,
    rowsToObjects,
    parseJsonRows,
    extractPdfText,
    normalizeStudentRow,
    type CanonicalStudentRow,
} from '@/lib/import-parsers';

export const dynamic = 'force-dynamic';

const IMPORT_ROLES = ['REGISTRAR_ADMIN', 'SUPER_ADMIN'];

/**
 * True when a Prisma unique-constraint error is specifically a rollNo
 * collision on the compound [schoolId, rollNo] unique index.
 */
function isRollNoCollision(err: unknown): boolean {
    const e = err as { code?: string; meta?: { target?: string | string[] } } | null;
    if (e?.code !== 'P2002') return false;
    const target = e?.meta?.target;
    if (target == null) return true;
    if (typeof target === 'string') return target.includes('rollNo');
    if (Array.isArray(target)) return target.some((f) => f === 'rollNo');
    return true;
}

const VALID_STATUSES = new Set(['ACTIVE', 'ON_LEAVE', 'GRADUATED', 'DROPPED', 'TRANSFERRED']);

function detectFormat(filename: string): 'csv' | 'json' | 'pdf' | null {
    const name = filename.toLowerCase();
    if (name.endsWith('.csv')) return 'csv';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.pdf')) return 'pdf';
    return null;
}

/**
 * POST /api/students/import — bulk create-or-update students from an uploaded
 * CSV / JSON / PDF document (REGISTRAR_ADMIN).
 *
 * Multipart form-data:
 *   - `file`      : the uploaded document (required).
 *   - `schoolId`  : target school (only honoured for central officers).
 *
 * Matching: a row updates an existing student when its email or rollNo matches
 * within the target school; otherwise it is created when program + batch can be
 * resolved. Response: `{ total, created, updated, skipped, errors }`.
 */
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!IMPORT_ROLES.includes(user.role)) {
            throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
        }

        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) {
            throw new ApiError(400, 'FILE_REQUIRED', 'A file upload is required (multipart form-data field "file").');
        }
        const bodySchoolId = (form.get('schoolId') as string | null) ?? undefined;
        const targetSchoolId = resolveCreateTenant(user, bodySchoolId);

        const fmt = detectFormat(file.name);
        if (!fmt) {
            throw new ApiError(400, 'UNSUPPORTED_FORMAT', 'Supported formats: .csv, .json, .pdf');
        }

        const buf = Buffer.from(await file.arrayBuffer());

        let rows: CanonicalStudentRow[];
        if (fmt === 'pdf') {
            const text = extractPdfText(buf);
            if (!text) {
                throw new ApiError(400, 'PDF_NO_TEXT', 'Could not extract text from the PDF. Use CSV or JSON instead.');
            }
            rows = rowsToObjects(parseCsv(text)).map((r) => normalizeStudentRow(r));
        } else {
            const text = buf.toString('utf8');
            if (fmt === 'csv') {
                rows = rowsToObjects(parseCsv(text)).map((r) => normalizeStudentRow(r));
            } else {
                rows = parseJsonRows(text).map((r) => normalizeStudentRow(r));
            }
        }

        if (rows.length === 0) {
            throw new ApiError(400, 'EMPTY_FILE', 'No importable rows found in file');
        }

        const result = await withClient(user, async (db) => {
            const summary = { total: rows.length, created: 0, updated: 0, skipped: 0 };
            const errors: { row: number; reason: string }[] = [];

            const programs = await db.program.findMany({
                where: { schoolId: targetSchoolId },
                select: { id: true, code: true, name: true },
            });
            const batches = await db.batch.findMany({
                where: { schoolId: targetSchoolId },
                select: { id: true, programId: true, name: true },
            });

            const programByKey = new Map<string, string>();
            for (const p of programs) {
                if (p.code) programByKey.set(p.code.toLowerCase(), p.id);
                if (p.name) programByKey.set(p.name.toLowerCase(), p.id);
            }
            const batchByKey = new Map<string, string>();
            for (const b of batches) {
                if (b.name) batchByKey.set(b.name.toLowerCase(), b.id);
            }

            /**
             * Resolve a program id from the row: explicit programId, else by code/name.
             */
            const resolveProgram = (c: CanonicalStudentRow): string | undefined => {
                if (c.programId) return c.programId;
                if (c.programCode) return programByKey.get(c.programCode.toLowerCase());
                return undefined;
            };

            /**
             * Resolve a batch id from the row and verify it belongs to the program.
             */
            const resolveBatch = (c: CanonicalStudentRow, programId: string): string | undefined => {
                const batchId = c.batchId ?? (c.batchName ? batchByKey.get(c.batchName.toLowerCase()) : undefined);
                if (!batchId) return undefined;
                const batch = batches.find((b) => b.id === batchId);
                if (!batch || batch.programId !== programId) return undefined;
                return batchId;
            };

            for (let i = 0; i < rows.length; i++) {
                const canon = rows[i];
                const lineNo = i + 2;
                try {
                    // Attempt to match an existing student.
                    const existing = canon.email || canon.rollNo
                        ? await db.student.findFirst({
                            where: {
                                schoolId: targetSchoolId,
                                OR: [
                                    ...(canon.email ? [{ email: canon.email }] : []),
                                    ...(canon.rollNo ? [{ rollNo: canon.rollNo }] : []),
                                ],
                            },
                        })
                        : null;

                    if (existing) {
                        const data: Record<string, string> = {};
                        if (canon.firstName) data.firstName = canon.firstName;
                        if (canon.lastName) data.lastName = canon.lastName;
                        if (canon.phone) data.phone = canon.phone;
                        if (canon.gender) data.gender = canon.gender;
                        if (canon.category) data.category = canon.category;
                        if (canon.status && VALID_STATUSES.has(canon.status)) data.status = canon.status;
                        if (Object.keys(data).length > 0) {
                            await db.student.update({ where: { id: existing.id }, data });
                            summary.updated++;
                        } else {
                            summary.skipped++;
                        }
                        continue;
                    }

                    // Create path.
                    const programId = resolveProgram(canon);
                    if (!programId) {
                        errors.push({ row: lineNo, reason: 'New student requires a program (programId/programCode)' });
                        summary.skipped++;
                        continue;
                    }
                    const batchId = resolveBatch(canon, programId);
                    if (!batchId) {
                        errors.push({ row: lineNo, reason: 'New student requires a batch in the selected program (batchId/batchName)' });
                        summary.skipped++;
                        continue;
                    }
                    if (!canon.firstName || !canon.lastName || !canon.email) {
                        errors.push({ row: lineNo, reason: 'firstName, lastName and email are required to create a student' });
                        summary.skipped++;
                        continue;
                    }
                    const program = programs.find((p) => p.id === programId);
                    if (!program) {
                        errors.push({ row: lineNo, reason: 'Program not found in this school' });
                        summary.skipped++;
                        continue;
                    }

                    const dup = await db.student.findFirst({
                        where: { email: canon.email, schoolId: targetSchoolId },
                    });
                    if (dup) {
                        errors.push({ row: lineNo, reason: 'Email already in use in this school' });
                        summary.skipped++;
                        continue;
                    }

                    let created: { id: string; rollNo: string } | null = null;
                    for (let attempt = 0; attempt < 20; attempt++) {
                        const rollNo = await generateRollNo(db, { id: programId, code: program.code }, targetSchoolId);
                        try {
                            created = await db.student.create({
                                data: {
                                    schoolId: targetSchoolId,
                                    rollNo,
                                    programId,
                                    batchId,
                                    firstName: canon.firstName,
                                    lastName: canon.lastName,
                                    email: canon.email,
                                    phone: canon.phone || '0000000000',
                                    dob: canon.dob || '2004-01-01',
                                    gender: canon.gender || 'Not specified',
                                    category: canon.category || 'General',
                                },
                                select: { id: true, rollNo: true },
                            });
                            break;
                        } catch (err) {
                            if (!isRollNoCollision(err)) throw err;
                        }
                    }

                    if (!created) {
                        errors.push({ row: lineNo, reason: 'Could not allocate a unique roll number' });
                        summary.skipped++;
                        continue;
                    }
                    summary.created++;
                } catch (e) {
                    errors.push({ row: lineNo, reason: e instanceof Error ? e.message : String(e) });
                    summary.skipped++;
                }
            }

            await writeAuditLog(db, {
                schoolId: targetSchoolId,
                actorId: user.userId,
                action: 'STUDENT_IMPORT',
                entityType: 'STUDENT',
                entityId: 'bulk',
                summary: `Import: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped`,
                metadata: JSON.stringify(summary),
            });

            return { ...summary, errors };
        });

        return successResponse(result, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
