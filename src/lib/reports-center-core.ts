// ==============================================================================
// Reports Center (Export Hub) — backend business logic (Batch E).
// Aggregates read-only data from existing modules (fees, results, attendance,
// certificates, admissions) behind one "pick report → set filters → preview →
// download CSV/PDF" flow. Mirrors docs/specs/reports-center.md (FROZEN).
//
// Design rules from the spec:
//   - Report TYPES are a whitelist; unknown type → 400.
//   - Each type declares a domain; access is gated by `canUseReportType` (pure).
//   - Row builders (`buildFeeReport`, `buildMarksheetReport`, ...) are PURE —
//     they take normalized input arrays and return `{ columns, rows }`, so the
//     tester can unit-test them without a database. They reuse the same builders.
//   - CSV output reuses the same rows and is escaped via `csvEscape`.
//   - Saved reports are scoped by owner + school; a user cannot delete another's.
// ==============================================================================

import type { AuthPayload } from './auth';
import { ApiError } from './errors';
import type { Db } from './prisma';

// ---- Domain / type vocabulary --------------------------------------------------

export type ReportDomain = 'fees' | 'results' | 'attendance' | 'certificates' | 'admissions';
export type ReportType =
    | 'fee-receipts'
    | 'marksheets'
    | 'attendance'
    | 'certificates'
    | 'admissions-seats';
export type ReportFormat = 'csv' | 'pdf';

export interface FilterDef {
    key: string;
    label: string;
    kind: 'text' | 'select' | 'date';
}

export interface ReportTypeDef {
    key: ReportType;
    domain: ReportDomain;
    label: string;
    description: string;
    filters: FilterDef[];
}

/** Whitelist of report types (spec §6: unknown type → 400). */
export const REPORT_TYPES: ReportTypeDef[] = [
    {
        key: 'fee-receipts',
        domain: 'fees',
        label: 'Fee Receipts',
        description: 'Payment receipts issued against fee invoices.',
        filters: [
            { key: 'from', label: 'From date', kind: 'date' },
            { key: 'to', label: 'To date', kind: 'date' },
            { key: 'studentId', label: 'Student', kind: 'text' },
        ],
    },
    {
        key: 'marksheets',
        domain: 'results',
        label: 'Marksheets',
        description: 'Published exam marks by course and student.',
        filters: [
            { key: 'examId', label: 'Exam', kind: 'select' },
            { key: 'courseId', label: 'Course', kind: 'select' },
            { key: 'studentId', label: 'Student', kind: 'text' },
        ],
    },
    {
        key: 'attendance',
        domain: 'attendance',
        label: 'Attendance Register',
        description: 'Daily attendance records per course.',
        filters: [
            { key: 'from', label: 'From date', kind: 'date' },
            { key: 'to', label: 'To date', kind: 'date' },
            { key: 'courseId', label: 'Course', kind: 'select' },
        ],
    },
    {
        key: 'certificates',
        domain: 'certificates',
        label: 'Certificates Issued',
        description: 'Issued certificates with reference numbers.',
        filters: [
            { key: 'from', label: 'From date', kind: 'date' },
            { key: 'to', label: 'To date', kind: 'date' },
            { key: 'type', label: 'Type', kind: 'select' },
        ],
    },
    {
        key: 'admissions-seats',
        domain: 'admissions',
        label: 'Admission / Seat List',
        description: 'Applications and seat allocation by admission cycle.',
        filters: [
            { key: 'cycleId', label: 'Cycle', kind: 'select' },
            { key: 'status', label: 'Status', kind: 'select' },
        ],
    },
];

export function isReportType(value: unknown): value is ReportType {
    return typeof value === 'string' && REPORT_TYPES.some((t) => t.key === value);
}

export function getReportType(key: string): ReportTypeDef | undefined {
    return REPORT_TYPES.find((t) => t.key === key);
}

// ---- Access control (pure) -----------------------------------------------------

/** Built-in roles that may use a whole domain of reports. */
const DOMAIN_ROLE_ALLOW: Partial<Record<ReportDomain, string[]>> = {
    fees: ['FINANCE_OFFICER'],
    results: ['EXAM_CONTROLLER'],
    attendance: ['DEAN', 'FACULTY'],
};

/**
 * Pure gate: can `user` use report type `typeKey`?
 * - SUPER_ADMIN and REGISTRAR_ADMIN see every domain.
 * - Custom roles carrying `reports.view` see every domain.
 * - Certificate reports additionally open to `certificates.view`.
 * - Admissions reports additionally open to `admissions.manage`/`admissions.view`.
 * - Otherwise the built-in domain role map decides.
 */
export function canUseReportType(
    user: { role?: string | null; permissions?: string[] | null },
    typeKey: unknown
): boolean {
    if (!isReportType(typeKey)) return false;
    const def = getReportType(typeKey)!;

    if (user.role === 'SUPER_ADMIN' || user.role === 'REGISTRAR_ADMIN') return true;

    const perms = user.permissions ?? [];
    if (perms.includes('reports.view') || perms.includes('reports.manage')) return true;

    const roles = DOMAIN_ROLE_ALLOW[def.domain];
    if (roles && user.role && roles.includes(user.role)) return true;

    if (def.domain === 'certificates') return perms.includes('certificates.view');
    if (def.domain === 'admissions') {
        return perms.includes('admissions.manage') || perms.includes('admissions.view');
    }
    return false;
}

/** Throws 400 for an unknown type; 403 when the user lacks domain access. */
export function assertReportCenterTypeAccess(user: AuthPayload, typeKey: unknown): void {
    if (!isReportType(typeKey)) {
        throw new ApiError(400, 'UNKNOWN_REPORT_TYPE', 'Unknown report type');
    }
    if (!canUseReportType(user, typeKey)) {
        throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this report type');
    }
}

/** `fmt` is restricted to csv|pdf else 400 (spec §6). Defaults to csv. */
export function requireReportFormat(url: URL): ReportFormat {
    const fmt = url.searchParams.get('fmt') ?? 'csv';
    if (fmt !== 'csv' && fmt !== 'pdf') {
        throw new ApiError(400, 'INVALID_FORMAT', 'fmt must be "csv" or "pdf"');
    }
    return fmt;
}

// ---- Pure row builders (unit-tested) ------------------------------------------

export interface ReportTable {
    columns: string[];
    rows: Record<string, unknown>[];
}

export interface FeeReceiptRow {
    receiptNo: string;
    invoiceNo: string;
    studentName: string;
    rollNo: string;
    amount: number;
    mode: string;
    paidAt: string;
}

export function buildFeeReport(receipts: FeeReceiptRow[]): ReportTable {
    const columns = ['Receipt No', 'Invoice No', 'Student', 'Roll No', 'Amount', 'Mode', 'Paid At'];
    const rows = receipts.map((r) => ({
        'Receipt No': r.receiptNo,
        'Invoice No': r.invoiceNo,
        Student: r.studentName,
        'Roll No': r.rollNo,
        Amount: Number(r.amount),
        Mode: r.mode,
        'Paid At': r.paidAt,
    }));
    return { columns, rows };
}

export interface MarksheetRow {
    examName: string;
    courseCode: string;
    courseName: string;
    studentName: string;
    rollNo: string;
    internal: number;
    external: number;
    total: number;
    grade: string;
}

export function buildMarksheetReport(rowsIn: MarksheetRow[]): ReportTable {
    const columns = ['Exam', 'Course Code', 'Course', 'Student', 'Roll No', 'Internal', 'External', 'Total', 'Grade'];
    const rows = rowsIn.map((r) => ({
        Exam: r.examName,
        'Course Code': r.courseCode,
        Course: r.courseName,
        Student: r.studentName,
        'Roll No': r.rollNo,
        Internal: Number(r.internal),
        External: Number(r.external),
        Total: Number(r.total),
        Grade: r.grade,
    }));
    return { columns, rows };
}

export interface AttendanceRowData {
    date: string;
    courseCode: string;
    courseName: string;
    studentName: string;
    rollNo: string;
    status: string;
}

export function buildAttendanceReport(rowsIn: AttendanceRowData[]): ReportTable {
    const columns = ['Date', 'Course Code', 'Course', 'Student', 'Roll No', 'Status'];
    const rows = rowsIn.map((r) => ({
        Date: r.date,
        'Course Code': r.courseCode,
        Course: r.courseName,
        Student: r.studentName,
        'Roll No': r.rollNo,
        Status: r.status,
    }));
    return { columns, rows };
}

export interface CertificateRowData {
    requestNo: string;
    referenceNo: string;
    type: string;
    studentName: string;
    rollNo: string;
    status: string;
    issuedAt: string;
}

export function buildCertificateReport(rowsIn: CertificateRowData[]): ReportTable {
    const columns = ['Request No', 'Reference No', 'Type', 'Student', 'Roll No', 'Status', 'Issued At'];
    const rows = rowsIn.map((r) => ({
        'Request No': r.requestNo,
        'Reference No': r.referenceNo,
        Type: r.type,
        Student: r.studentName,
        'Roll No': r.rollNo,
        Status: r.status,
        'Issued At': r.issuedAt,
    }));
    return { columns, rows };
}

export interface AdmissionRowData {
    applicationNo: string;
    cycleName: string;
    applicantName: string;
    program: string;
    category: string;
    marks: number;
    status: string;
    seatAllocated: boolean;
}

export function buildAdmissionReport(rowsIn: AdmissionRowData[]): ReportTable {
    const columns = ['Application No', 'Cycle', 'Applicant', 'Program', 'Category', 'Marks %', 'Status', 'Seat Allocated'];
    const rows = rowsIn.map((r) => ({
        'Application No': r.applicationNo,
        Cycle: r.cycleName,
        Applicant: r.applicantName,
        Program: r.program,
        Category: r.category,
        'Marks %': Number(r.marks),
        Status: r.status,
        'Seat Allocated': r.seatAllocated ? 'Yes' : 'No',
    }));
    return { columns, rows };
}

// ---- CSV helpers (pure, unit-tested) ------------------------------------------

export function csvEscape(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
    const header = columns.map((c) => csvEscape(c)).join(',');
    const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(',')).join('\n');
    return body ? `${header}\n${body}` : header;
}

export function reportToCsv(table: ReportTable): string {
    return rowsToCsv(table.columns, table.rows);
}

/** Minimal printable HTML wrapping a report table (used for PDF export). */
export function reportToPrintHtml(table: ReportTable): string {
    const thead = table.columns.map((c) => `<th>${csvEscape(c)}</th>`).join('');
    const tbodyRows = table.rows
        .map(
            (r) =>
                `<tr>${table.columns.map((c) => `<td>${csvEscape(r[c])}</td>`).join('')}</tr>`
        )
        .join('');
    return `<html><head><meta charset="utf-8"><title>Report</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:32px;color:#0f172a}
h1{font-size:20px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
th{background:#f1f5f9;font-weight:600}
</style></head><body><h1>Report</h1><table><thead><tr>${thead}</tr></thead><tbody>${tbodyRows}</tbody></table></body></html>`;
}

// ---- Data fetching (DB-aware, tenant-scoped) -----------------------------------

function parseDateParam(value: string | null): Date | undefined {
    if (!value || !value.trim()) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function buildReportData(
    db: Db,
    schoolId: string,
    type: ReportType,
    url: URL
): Promise<ReportTable> {
    switch (type) {
        case 'fee-receipts':
            return fetchFeeReceipts(db, schoolId, url);
        case 'marksheets':
            return fetchMarksheets(db, schoolId, url);
        case 'attendance':
            return fetchAttendance(db, schoolId, url);
        case 'certificates':
            return fetchCertificates(db, schoolId, url);
        case 'admissions-seats':
            return fetchAdmissions(db, schoolId, url);
    }
}

async function fetchFeeReceipts(db: Db, schoolId: string, url: URL): Promise<ReportTable> {
    const where: { schoolId: string; createdAt?: { gte?: Date; lte?: Date } } = { schoolId };
    const from = parseDateParam(url.searchParams.get('from'));
    const to = parseDateParam(url.searchParams.get('to'));
    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = from;
        if (to) where.createdAt.lte = to;
    }

    const payments = await db.payment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: { id: true, receiptNo: true, amount: true, mode: true, createdAt: true, invoiceId: true },
    });
    const invoiceIds = Array.from(new Set(payments.map((p) => p.invoiceId).filter(Boolean)));
    const invoices = invoiceIds.length
        ? await db.invoice.findMany({
            where: { id: { in: invoiceIds } },
            select: { id: true, invoiceNo: true, studentId: true },
        })
        : [];
    const invMap = new Map(invoices.map((i) => [i.id, i]));

    const studentIds = Array.from(new Set(invoices.map((i) => i.studentId).filter(Boolean)));
    const students = studentIds.length
        ? await db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true, rollNo: true },
        })
        : [];
    const studMap = new Map(students.map((s) => [s.id, s]));

    const studentFilter = url.searchParams.get('studentId');
    const rows = payments
        .map((p) => {
            const inv = p.invoiceId ? invMap.get(p.invoiceId) : undefined;
            const st = inv ? studMap.get(inv.studentId) : undefined;
            return {
                internalStudentId: inv?.studentId ?? '',
                row: {
                    receiptNo: p.receiptNo,
                    invoiceNo: inv?.invoiceNo ?? '',
                    studentName: st ? `${st.firstName} ${st.lastName}` : '',
                    rollNo: st?.rollNo ?? '',
                    amount: Number(p.amount),
                    mode: p.mode,
                    paidAt: p.createdAt.toISOString(),
                } as FeeReceiptRow,
            };
        })
        .filter((x) => !studentFilter || x.internalStudentId === studentFilter)
        .map((x) => x.row);

    return buildFeeReport(rows);
}

async function fetchMarksheets(db: Db, schoolId: string, url: URL): Promise<ReportTable> {
    const where: { schoolId: string; examId?: { in: string[] } } = { schoolId };

    const examId = url.searchParams.get('examId');
    const courseId = url.searchParams.get('courseId');
    const studentId = url.searchParams.get('studentId');
    if (examId) where.examId = { in: [examId] };

    const marks = await db.marksEntry.findMany({
        where,
        select: { id: true, examId: true, studentId: true, internalMarks: true, externalMarks: true, totalMarks: true, grade: true },
    });

    const examIds = Array.from(new Set(marks.map((m) => m.examId).filter(Boolean)));
    const exams = examIds.length
        ? await db.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true } })
        : [];
    const examMap = new Map(exams.map((e) => [e.id, e]));

    const studentIds = Array.from(new Set(marks.map((m) => m.studentId).filter(Boolean)));
    const students = studentIds.length
        ? await db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true, rollNo: true },
        })
        : [];
    const studMap = new Map(students.map((s) => [s.id, s]));

    // Course resolution via exam schedule: we approximate by courseId param when given.
    const courseFilter = courseId;
    const rows = marks
        .filter((m) => !studentId || m.studentId === studentId)
        .map((m) => {
            const st = studMap.get(m.studentId);
            return {
                examName: examMap.get(m.examId)?.title ?? '',
                courseCode: courseFilter ?? '',
                courseName: courseFilter ?? '',
                studentName: st ? `${st.firstName} ${st.lastName}` : '',
                rollNo: st?.rollNo ?? '',
                internal: Number(m.internalMarks),
                external: Number(m.externalMarks),
                total: Number(m.totalMarks),
                grade: m.grade ?? '',
            } as MarksheetRow;
        });

    return buildMarksheetReport(rows);
}

async function fetchAttendance(db: Db, schoolId: string, url: URL): Promise<ReportTable> {
    const where: { schoolId: string; date?: { gte?: Date; lte?: Date }; courseId?: string } = { schoolId };
    const from = parseDateParam(url.searchParams.get('from'));
    const to = parseDateParam(url.searchParams.get('to'));
    if (from || to) {
        where.date = {};
        if (from) where.date.gte = from;
        if (to) where.date.lte = to;
    }
    const courseId = url.searchParams.get('courseId');
    if (courseId) where.courseId = courseId;

    const records = await db.attendanceRecord.findMany({
        where,
        orderBy: { date: 'asc' },
        select: { id: true, courseId: true, studentId: true, date: true, status: true },
    });

    const courseIds = Array.from(new Set(records.map((r) => r.courseId).filter(Boolean)));
    const courses = courseIds.length
        ? await db.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, code: true, title: true } })
        : [];
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const studentIds = Array.from(new Set(records.map((r) => r.studentId).filter(Boolean)));
    const students = studentIds.length
        ? await db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true, rollNo: true },
        })
        : [];
    const studMap = new Map(students.map((s) => [s.id, s]));

    const rows = records.map((r) => {
        const c = courseMap.get(r.courseId);
        const st = studMap.get(r.studentId);
        return {
            date: r.date.toISOString().slice(0, 10),
            courseCode: c?.code ?? '',
            courseName: c?.title ?? '',
            studentName: st ? `${st.firstName} ${st.lastName}` : '',
            rollNo: st?.rollNo ?? '',
            status: r.status,
        } as AttendanceRowData;
    });

    return buildAttendanceReport(rows);
}

async function fetchCertificates(db: Db, schoolId: string, url: URL): Promise<ReportTable> {
    const where: { schoolId: string; createdAt?: { gte?: Date; lte?: Date }; type?: string } = { schoolId };
    const from = parseDateParam(url.searchParams.get('from'));
    const to = parseDateParam(url.searchParams.get('to'));
    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = from;
        if (to) where.createdAt.lte = to;
    }
    const type = url.searchParams.get('type');
    if (type) where.type = type;

    const certs = await db.certificate.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: { id: true, requestNo: true, referenceNo: true, type: true, studentId: true, status: true, issuedAt: true },
    });

    const studentIds = Array.from(new Set(certs.map((c) => c.studentId).filter(Boolean)));
    const students = studentIds.length
        ? await db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true, rollNo: true },
        })
        : [];
    const studMap = new Map(students.map((s) => [s.id, s]));

    const rows = certs.map((c) => {
        const st = studMap.get(c.studentId);
        return {
            requestNo: c.requestNo,
            referenceNo: c.referenceNo ?? '',
            type: c.type,
            studentName: st ? `${st.firstName} ${st.lastName}` : '',
            rollNo: st?.rollNo ?? '',
            status: c.status,
            issuedAt: c.issuedAt ? c.issuedAt.toISOString().slice(0, 10) : '',
        } as CertificateRowData;
    });

    return buildCertificateReport(rows);
}

async function fetchAdmissions(db: Db, schoolId: string, url: URL): Promise<ReportTable> {
    const where: { schoolId: string; cycleId?: string; status?: string } = { schoolId };
    const cycleId = url.searchParams.get('cycleId');
    const status = url.searchParams.get('status');
    if (cycleId) where.cycleId = cycleId;
    if (status) where.status = status;

    const apps = await db.application.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            applicationNo: true,
            cycleId: true,
            programId: true,
            applicantName: true,
            category: true,
            marksPercentage: true,
            status: true,
            seatAllocated: true,
        },
    });

    const cycleIds = Array.from(new Set(apps.map((a) => a.cycleId).filter(Boolean)));
    const cycles = cycleIds.length
        ? await db.admissionCycle.findMany({ where: { id: { in: cycleIds } }, select: { id: true, title: true } })
        : [];
    const cycleMap = new Map(cycles.map((c) => [c.id, c]));

    const programIds = Array.from(new Set(apps.map((a) => a.programId).filter(Boolean)));
    const programs = programIds.length
        ? await db.program.findMany({ where: { id: { in: programIds } }, select: { id: true, name: true } })
        : [];
    const programMap = new Map(programs.map((p) => [p.id, p]));

    const rows = apps.map((a) => ({
        applicationNo: a.applicationNo,
        cycleName: cycleMap.get(a.cycleId)?.title ?? '',
        applicantName: a.applicantName,
        program: programMap.get(a.programId)?.name ?? '',
        category: a.category,
        marks: Number(a.marksPercentage),
        status: a.status,
        seatAllocated: a.seatAllocated,
    })) as AdmissionRowData[];

    return buildAdmissionReport(rows);
}

// ---- Saved reports (scoped by owner + school) ----------------------------------

export interface SavedReportShape {
    id: string;
    name: string;
    type: ReportType;
    filters: Record<string, unknown>;
    createdAt: string;
}

function safeJson(raw: string): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

export async function listSavedReports(
    db: Db,
    schoolId: string,
    ownerId: string
): Promise<SavedReportShape[]> {
    const rows = await db.savedReport.findMany({
        where: { schoolId, ownerId },
        orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: isReportType(r.type) ? r.type : 'attendance',
        filters: safeJson(r.filters),
        createdAt: r.createdAt.toISOString(),
    }));
}

export async function saveSavedReport(
    db: Db,
    opts: {
        schoolId: string;
        ownerId: string;
        name: string;
        type: ReportType;
        filters: Record<string, unknown>;
    }
): Promise<SavedReportShape> {
    const created = await db.savedReport.create({
        data: {
            schoolId: opts.schoolId,
            ownerId: opts.ownerId,
            name: opts.name,
            type: opts.type,
            filters: JSON.stringify(opts.filters),
        },
    });
    return {
        id: created.id,
        name: created.name,
        type: isReportType(created.type) ? created.type : 'attendance',
        filters: safeJson(created.filters),
        createdAt: created.createdAt.toISOString(),
    };
}

/** Owner + school scoped delete; returns false when nothing matched (or not owned). */
export async function deleteSavedReport(
    db: Db,
    schoolId: string,
    ownerId: string,
    id: string
): Promise<boolean> {
    try {
        const res = await db.savedReport.deleteMany({ where: { id, schoolId, ownerId } });
        return res.count > 0;
    } catch {
        return false;
    }
}
