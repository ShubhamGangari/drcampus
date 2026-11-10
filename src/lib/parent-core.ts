// ==============================================================================
// Parent Portal module (Batch E) — backend business logic.
// Read-only portal that lets a parent view linked wards' progress (attendance,
// fees, results, notices, exams) without mutating anything. Pure helpers (link
// ownership, fee-due math) live here so the tester can unit-test them without a
// database. Thin tenant/permission gates mirror the other modules.
//
// FROZEN rules (docs/specs/parent-portal.md §6):
//   - A parent sees only students linked to their account (ParentStudentLink
//     scoped by schoolId + parentUserId); any other student id -> 403.
//   - All portal endpoints are strictly read-only; there are no write routes on
//     attendance/fees/results. Guarded in the route layer.
//   - Link creation validates both parentUserId and studentId exist in the same
//     school; a duplicate pair -> 409.
// ==============================================================================

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';
import { type Db } from './prisma';
import { computeAttendancePercentage } from './attendance-core';
import { computeSGPA } from './gradecard-core';

// Re-export shared tenant/ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool, findSelfStudent } from './fee-core';

// ---- Shapes ------------------------------------------------------------------

export interface ParentLinkShape {
    parentUserId: string;
    studentId: string;
}

/** Card shape returned by `GET /api/parent/students`. */
export interface ParentWardCard {
    id: string;
    name: string;
    rollNo: string;
    program: string;
    className: string;
    attendancePercent: number | null;
    feeDues: number;
    gpa: number | null;
    unreadNotices: number;
}

// ---- Pure helpers (unit-tested) ----------------------------------------------

/**
 * True only when `studentId` appears in the caller's link set. A parent may only
 * ever view a ward linked to their account (spec §6.1); any other student id is
 * forbidden.
 */
export function canParentViewStudent(
    parentUserId: string,
    studentId: string,
    links: ParentLinkShape[]
): boolean {
    return (links || []).some(
        (l) => l.parentUserId === parentUserId && l.studentId === studentId
    );
}

const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Outstanding fee dues for a student: Σ max(0, amount − paidAmount) over
 * non-terminal invoices. Terminal (PAID/CANCELED/VOID) invoices contribute 0.
 */
export function computeFeeDues(
    invoices: Array<{ amount: number; paidAmount: number; status: string }>
): number {
    let total = 0;
    for (const inv of invoices || []) {
        if (inv.status === 'PAID' || inv.status === 'CANCELED' || inv.status === 'VOID') continue;
        total += Math.max(0, Number(inv.amount) - Number(inv.paidAmount));
    }
    return roundMoney(total);
}

/** Latest non-zero semester SGPA from a list of semester summaries. */
export function latestSemesterGpa(semesters: Array<{ semester: number; sgpa: number }>): number | null {
    const withSgpa = (semesters || []).filter((s) => Number.isFinite(Number(s.sgpa)) && s.sgpa > 0);
    if (withSgpa.length === 0) return null;
    withSgpa.sort((a, b) => b.semester - a.semester);
    return withSgpa[0].sgpa;
}

// ---- Tenant filter (mirrors sibling modules) ---------------------------------

export function tenantFilter(
    isCentral: boolean,
    schoolId: string | undefined
): Record<string, unknown> {
    if (!isCentral || !schoolId) return {};
    return { schoolId };
}

// ---- Permission gates (server-side) ------------------------------------------

export async function userHasPermission(
    user: { role: string; position?: string | null; customRoleId?: string | null },
    permission: string
): Promise<boolean> {
    const effective = await resolveUserEffectivePermissions(user);
    return effective.includes(permission as import('./perms').Permission);
}

/** Link management requires `parent.manage` (super-admin / registrar / custom). */
export function requireParentManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Parent link management permission required');
}

/** Read-only portal view requires `parent.view` (PARENT role or custom). */
export function requireParentView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'Parent view permission required');
}

// ---- DB aggregation helpers (used by routes) ----------------------------------

/**
 * Loads the linked ward cards for a parent user. Returns one card per link, each
 * with the summary metrics the dashboard shows. Only linked wards are returned.
 */
export async function loadWardCards(
    db: Db,
    tenant: Record<string, unknown>,
    parentUserId: string
): Promise<ParentWardCard[]> {
    const links = await db.parentStudentLink.findMany({
        where: { ...tenant, parentUserId },
        select: { studentId: true },
    });
    const studentIds = links.map((l) => l.studentId);
    if (studentIds.length === 0) return [];

    const students = await db.student.findMany({
        where: { ...tenant, id: { in: studentIds } },
        select: {
            id: true,
            rollNo: true,
            firstName: true,
            lastName: true,
            programId: true,
            batchId: true,
        },
    });

    const programIds = Array.from(new Set(students.map((s) => s.programId)));
    const batchIds = Array.from(new Set(students.map((s) => s.batchId)));
    const [programs, batches] = await Promise.all([
        programIds.length
            ? db.program.findMany({ where: { ...tenant, id: { in: programIds } }, select: { id: true, name: true } })
            : [],
        batchIds.length
            ? db.batch.findMany({ where: { ...tenant, id: { in: batchIds } }, select: { id: true, name: true } })
            : [],
    ]);
    const programMap = new Map(programs.map((p) => [p.id, p.name]));
    const batchMap = new Map(batches.map((b) => [b.id, b.name]));

    const [attendance, invoices] = await Promise.all([
        db.attendanceRecord.findMany({
            where: { ...tenant, studentId: { in: studentIds } },
            select: { studentId: true, status: true },
        }),
        db.invoice.findMany({
            where: { ...tenant, studentId: { in: studentIds } },
            select: { studentId: true, amount: true, paidAmount: true, status: true },
        }),
    ]);

    // Attendance aggregation per student.
    const attendanceAgg = new Map<string, { present: number; total: number }>();
    for (const r of attendance) {
        const g = attendanceAgg.get(r.studentId) ?? { present: 0, total: 0 };
        g.total++;
        if (r.status === 'PRESENT') g.present++;
        attendanceAgg.set(r.studentId, g);
    }

    // Fee dues per student.
    const invoiceByStudent = new Map<string, Array<{ amount: number; paidAmount: number; status: string }>>();
    for (const inv of invoices) {
        const arr = invoiceByStudent.get(inv.studentId) ?? [];
        arr.push(inv);
        invoiceByStudent.set(inv.studentId, arr);
    }

    // Per-student latest SGPA (reuse gradecard pure function).
    const gpaByStudent = await computeGpaByStudent(db, tenant, studentIds);

    return students.map((s) => {
        const att = attendanceAgg.get(s.id);
        const fees = invoiceByStudent.get(s.id) ?? [];
        return {
            id: s.id,
            name: `${s.firstName} ${s.lastName}`.trim(),
            rollNo: s.rollNo,
            program: programMap.get(s.programId) ?? '',
            className: batchMap.get(s.batchId) ?? '',
            attendancePercent: att ? computeAttendancePercentage(att.present, att.total) : null,
            feeDues: computeFeeDues(fees),
            gpa: gpaByStudent.get(s.id) ?? null,
            unreadNotices: 0,
        };
    });
}

/** Computes latest semester SGPA per student id (empty when none). */
export async function computeGpaByStudent(
    db: Db,
    tenant: Record<string, unknown>,
    studentIds: string[]
): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (studentIds.length === 0) return out;

    const entries = await db.marksEntry.findMany({
        where: { ...tenant, studentId: { in: studentIds }, grade: { not: null } },
        select: { studentId: true, scheduleId: true, grade: true },
    });
    const scheduleIds = Array.from(new Set(entries.map((e) => e.scheduleId)));
    if (scheduleIds.length === 0) return out;

    const schedules = await db.examSchedule.findMany({
        where: { ...tenant, id: { in: scheduleIds } },
        select: { id: true, examId: true },
    });
    const scheduleToExam = new Map(schedules.map((s) => [s.id, s.examId]));
    const examIds = Array.from(new Set(schedules.map((s) => s.examId)));

    const exams = examIds.length
        ? await db.exam.findMany({
            where: { ...tenant, id: { in: examIds } },
            select: { id: true, semester: true },
        })
        : [];
    const examToSemester = new Map(exams.map((e) => [e.id, e.semester]));

    const byStudent = new Map<string, Map<number, Array<{ grade: string }>>>();
    for (const e of entries) {
        const examId = scheduleToExam.get(e.scheduleId);
        const semester = examId ? examToSemester.get(examId) : undefined;
        if (semester === undefined) continue;
        const semMap = byStudent.get(e.studentId) ?? new Map<number, Array<{ grade: string }>>();
        const arr = semMap.get(semester) ?? [];
        arr.push({ grade: e.grade ?? 'F' });
        semMap.set(semester, arr);
        byStudent.set(e.studentId, semMap);
    }

    const studentEntries = Array.from(byStudent.entries());
    for (let i = 0; i < studentEntries.length; i++) {
        const [studentId, semMap] = studentEntries[i];
        const semEntries = Array.from(semMap.entries());
        const semesters: Array<{ semester: number; sgpa: number }> = semEntries.map(
            ([semester, grades]) => ({
                semester,
                sgpa: computeSGPA(
                    grades.map((g) => ({ credits: 1, grade: g.grade }))
                ),
            })
        );
        const latest = latestSemesterGpa(semesters);
        if (latest !== null) out.set(studentId, latest);
    }
    return out;
}

/**
 * Loads full read-only detail for one linked ward: summary, attendance, fees,
 * results, notices, exams. The caller MUST have already asserted ownership via
 * canParentViewStudent before invoking this.
 */
export async function loadWardDetail(
    db: Db,
    tenant: Record<string, unknown>,
    studentId: string
): Promise<Record<string, unknown>> {
    const student = await db.student.findUnique({
        where: { id: studentId },
        select: {
            id: true,
            rollNo: true,
            firstName: true,
            lastName: true,
            programId: true,
            batchId: true,
        },
    });
    const [program, batch] = await Promise.all([
        student && student.programId
            ? db.program.findUnique({ where: { id: student.programId }, select: { name: true } })
            : null,
        student && student.batchId
            ? db.batch.findUnique({ where: { id: student.batchId }, select: { name: true } })
            : null,
    ]);

    const summary = {
        id: student!.id,
        name: `${student!.firstName} ${student!.lastName}`.trim(),
        rollNo: student!.rollNo,
        program: program?.name ?? '',
        className: batch?.name ?? '',
    };

    // Attendance per-course breakdown.
    const attendanceRows = await db.attendanceRecord.findMany({
        where: { ...tenant, studentId },
        select: { courseId: true, status: true },
    });
    const courseAgg = new Map<string, { present: number; total: number }>();
    for (const r of attendanceRows) {
        const g = courseAgg.get(r.courseId) ?? { present: 0, total: 0 };
        g.total++;
        if (r.status === 'PRESENT') g.present++;
        courseAgg.set(r.courseId, g);
    }
    const courseIds = Array.from(courseAgg.keys());
    const courses = courseIds.length
        ? await db.course.findMany({ where: { ...tenant, id: { in: courseIds } }, select: { id: true, code: true, title: true, credits: true } })
        : [];
    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const attendance = Array.from(courseAgg.entries()).map(([courseId, g]) => ({
        courseId,
        code: courseMap.get(courseId)?.code ?? '',
        title: courseMap.get(courseId)?.title ?? '',
        credits: courseMap.get(courseId)?.credits ?? 0,
        totalDays: g.total,
        presentDays: g.present,
        percentage: computeAttendancePercentage(g.present, g.total),
    }));

    // Fees: invoices + payments.
    const invoices = await db.invoice.findMany({
        where: { ...tenant, studentId },
        select: { id: true, invoiceNo: true, amount: true, paidAmount: true, dueDate: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    });
    const invoiceIds = invoices.map((i) => i.id);
    const payments = invoiceIds.length
        ? await db.payment.findMany({
            where: { ...tenant, invoiceId: { in: invoiceIds } },
            select: { id: true, invoiceId: true, amount: true, mode: true, receiptNo: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        })
        : [];
    const fees = {
        invoices,
        payments,
        currentDue: computeFeeDues(invoices),
    };

    // Results: semester-wise SGPA + course rows.
    const results = await loadWardResults(db, tenant, studentId);

    // Exams: upcoming schedules (with course info).
    const now = new Date();
    const schedules = await db.examSchedule.findMany({
        where: { ...tenant, examDate: { gte: now } },
        select: { id: true, examId: true, courseId: true, examDate: true, startTime: true, venue: true },
        orderBy: { examDate: 'asc' },
    });
    const schedCourseIds = Array.from(new Set(schedules.map((s) => s.courseId)));
    const schedCourseMap = new Map(
        (
            await db.course.findMany({
                where: { ...tenant, id: { in: schedCourseIds } },
                select: { id: true, code: true, title: true },
            })
        ).map((c) => [c.id, c])
    );
    const exams = {
        upcoming: schedules.map((s) => ({
            id: s.id,
            examId: s.examId,
            code: schedCourseMap.get(s.courseId)?.code ?? '',
            title: schedCourseMap.get(s.courseId)?.title ?? '',
            examDate: s.examDate,
            startTime: s.startTime,
            venue: s.venue,
        })),
    };

    return { summary, attendance, fees, results, exams };
}

/** Semester-wise results: course rows per semester + SGPA per semester. */
export async function loadWardResults(
    db: Db,
    tenant: Record<string, unknown>,
    studentId: string
): Promise<Record<string, unknown>> {
    const entries = await db.marksEntry.findMany({
        where: { ...tenant, studentId, grade: { not: null } },
        select: { scheduleId: true, grade: true, internalMarks: true, externalMarks: true, totalMarks: true },
    });
    const scheduleIds = Array.from(new Set(entries.map((e) => e.scheduleId)));
    const schedules = scheduleIds.length
        ? await db.examSchedule.findMany({
            where: { ...tenant, id: { in: scheduleIds } },
            select: { id: true, examId: true, courseId: true },
        })
        : [];
    const scheduleToExam = new Map(schedules.map((s) => [s.id, s.examId]));
    const scheduleToCourse = new Map(schedules.map((s) => [s.id, s.courseId]));
    const examIds = Array.from(new Set(schedules.map((s) => s.examId)));
    const exams = examIds.length
        ? await db.exam.findMany({
            where: { ...tenant, id: { in: examIds } },
            select: { id: true, semester: true, academicYear: true },
        })
        : [];
    const examMap = new Map(exams.map((e) => [e.id, e]));
    const courseIds = Array.from(new Set(schedules.map((s) => s.courseId)));
    const courses = courseIds.length
        ? await db.course.findMany({
            where: { ...tenant, id: { in: courseIds } },
            select: { id: true, code: true, title: true, credits: true },
        })
        : [];
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const bySemester = new Map<number, Array<{
        code?: string;
        title?: string;
        credits: number;
        grade: string;
        internalMarks: number;
        externalMarks: number;
        totalMarks: number;
    }>>();

    for (const e of entries) {
        const exam = examMap.get(scheduleToExam.get(e.scheduleId) ?? '');
        if (!exam) continue;
        const course = courseMap.get(scheduleToCourse.get(e.scheduleId) ?? '');
        const arr = bySemester.get(exam.semester) ?? [];
        arr.push({
            code: course?.code,
            title: course?.title,
            credits: course?.credits ?? 0,
            grade: e.grade ?? 'F',
            internalMarks: e.internalMarks,
            externalMarks: e.externalMarks,
            totalMarks: e.totalMarks,
        });
        bySemester.set(exam.semester, arr);
    }

    const semesters = Array.from(bySemester.entries())
        .map(([semester, rows]) => ({
            semester,
            academicYear: '',
            sgpa: computeSGPA(rows),
            courses: rows,
        }))
        .sort((a, b) => a.semester - b.semester);

    return { semesters, latestGpa: latestSemesterGpa(semesters) };
}

// ---- Link management (admin) ---------------------------------------------------

/** Loads a parent user and asserts it belongs to `schoolId` (404 / 400). */
export async function assertParentUserBelongsToSchool(
    db: Db,
    parentUserId: string,
    schoolId: string
) {
    const parent = await db.user.findUnique({
        where: { id: parentUserId },
        select: { id: true, schoolId: true, name: true, active: true },
    });
    if (!parent) {
        throw new ApiError(404, 'NOT_FOUND', 'Parent user not found');
    }
    if (parent.schoolId !== schoolId) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Parent does not belong to this school');
    }
    return parent;
}

/**
 * Lists link rows with resolved parent/student names (used by the manage UI).
 * Optional filters: parentUserId, studentId. Scoped by `tenant`.
 */
export async function loadLinks(
    db: Db,
    tenant: Record<string, unknown>,
    filters: { parentUserId?: string; studentId?: string } = {}
): Promise<
    Array<{
        id: string;
        parentUserId: string;
        parentName: string;
        studentId: string;
        studentName: string;
    }>
> {
    const where: Record<string, unknown> = { ...tenant };
    if (filters.parentUserId) where.parentUserId = filters.parentUserId;
    if (filters.studentId) where.studentId = filters.studentId;

    const links = await db.parentStudentLink.findMany({
        where,
        select: { id: true, parentUserId: true, studentId: true },
        orderBy: { createdAt: 'desc' },
    });
    if (links.length === 0) return [];

    const parentIds = Array.from(new Set(links.map((l) => l.parentUserId)));
    const studentIds = Array.from(new Set(links.map((l) => l.studentId)));

    const [parents, students] = await Promise.all([
        parentIds.length
            ? db.user.findMany({ where: { id: { in: parentIds } }, select: { id: true, name: true } })
            : [],
        studentIds.length
            ? db.student.findMany({
                where: { id: { in: studentIds } },
                select: { id: true, firstName: true, lastName: true },
            })
            : [],
    ]);
    const parentMap = new Map(parents.map((p) => [p.id, p.name]));
    const studentMap = new Map(
        students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()])
    );

    return links.map((l) => ({
        id: l.id,
        parentUserId: l.parentUserId,
        parentName: parentMap.get(l.parentUserId) ?? '',
        studentId: l.studentId,
        studentName: studentMap.get(l.studentId) ?? '',
    }));
}
