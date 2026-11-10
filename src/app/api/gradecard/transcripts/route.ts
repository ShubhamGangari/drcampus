import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { issueTranscriptSchema } from '@/lib/gradecard-schemas';
import {
    resolveCreateTenant,
    assertStudentBelongsToSchool,
    tenantFilter,
    userHasPermission,
    computeSGPA,
    computeCGPA,
} from '@/lib/gradecard-core';
import { getNextSequence } from '@/lib/fee-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/gradecard/transcripts?schoolId=
// Lists issued transcripts (gradecard.view OR gradecard.manage). 200
// { transcripts: [{ id, studentId, studentName, transcriptNo, issuedAt,
//                   semester, academicYear, type, cgpa, sgpa }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const hasView = await userHasPermission(user, 'gradecard.view');
        const hasManage = await userHasPermission(user, 'gradecard.manage');
        if (!hasView && !hasManage) {
            throw new ApiError(403, 'FORBIDDEN', 'Grade card view permission required');
        }

        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const transcripts = await withClient(user, async (db) => {
            const rows = await db.transcript.findMany({
                where: tenantFilter(isCentralUser(user), schoolId),
                orderBy: { issuedAt: 'desc' },
            });

            const studentIds = Array.from(new Set(rows.map((r) => r.studentId)));
            const students = studentIds.length
                ? await db.student.findMany({
                    where: { id: { in: studentIds } },
                    select: { id: true, firstName: true, lastName: true, rollNo: true },
                })
                : [];
            const studentMap = new Map(students.map((s) => [s.id, s]));

            return rows.map((t) => {
                const student = studentMap.get(t.studentId);
                return {
                    id: t.id,
                    studentId: t.studentId,
                    studentName: student ? `${student.firstName} ${student.lastName}`.trim() : null,
                    rollNo: student?.rollNo ?? null,
                    transcriptNo: t.transcriptNo,
                    issuedAt: t.issuedAt.toISOString(),
                    semester: t.semester,
                    academicYear: t.academicYear,
                    type: t.type,
                    cgpa: t.cgpa,
                    sgpa: t.sgpa,
                };
            });
        });

        return successResponse({ transcripts });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/gradecard/transcripts — issue a transcript (gradecard.manage). 201
// { transcript }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'gradecard.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Grade card management permission required');
        }

        const body = await validateBody(request, issueTranscriptSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const transcript = await withClient(user, async (db) => {
            const student = await assertStudentBelongsToSchool(db, body.studentId, tenant);

            const entries = await db.marksEntry.findMany({
                where: { schoolId: tenant, studentId: body.studentId, grade: { not: null } },
                select: { scheduleId: true, grade: true },
            });
            if (entries.length === 0) {
                throw new ApiError(400, 'NO_PUBLISHED_RESULT', 'Student has no published results yet');
            }

            const scheduleIds = Array.from(new Set(entries.map((e) => e.scheduleId)));
            const schedules = await db.examSchedule.findMany({
                where: { schoolId: tenant, id: { in: scheduleIds } },
                select: { id: true, examId: true, courseId: true },
            });
            const scheduleToExam = new Map(schedules.map((s) => [s.id, s.examId]));
            const scheduleToCourse = new Map(schedules.map((s) => [s.id, s.courseId]));

            const examIds = Array.from(new Set(schedules.map((s) => s.examId)));
            const exams = await db.exam.findMany({
                where: { schoolId: tenant, id: { in: examIds } },
                select: { id: true, semester: true, academicYear: true },
            });
            const examMap = new Map(exams.map((e) => [e.id, e]));

            const courseIds = Array.from(new Set(schedules.map((s) => s.courseId)));
            const courses = await db.course.findMany({
                where: { schoolId: tenant, id: { in: courseIds } },
                select: { id: true, credits: true },
            });
            const creditMap = new Map(courses.map((c) => [c.id, c.credits]));

            const summaries = new Map<string, { semester: number; academicYear: string; entries: Array<{ credits: number; grade: string }> }>();
            for (const entry of entries) {
                const exam = examMap.get(scheduleToExam.get(entry.scheduleId) ?? '');
                if (!exam) continue;
                const key = `${exam.semester}|${exam.academicYear}`;
                const credits = creditMap.get(scheduleToCourse.get(entry.scheduleId) ?? '') ?? 0;
                const summary = summaries.get(key) ?? { semester: exam.semester, academicYear: exam.academicYear, entries: [] };
                summary.entries.push({ credits, grade: entry.grade ?? 'F' });
                summaries.set(key, summary);
            }

            const semesterSummaries = Array.from(summaries.values()).map((s) => ({
                semester: s.semester,
                academicYear: s.academicYear,
                sgpa: computeSGPA(s.entries),
            }));

            const cgpa = computeCGPA(semesterSummaries);
            let sgpa: number | null = cgpa;
            let semester: number | null = null;
            let academicYear: string | null = null;
            if (body.type === 'SEMESTER') {
                if (body.semester == null) {
                    throw new ApiError(400, 'BAD_REQUEST', 'semester is required for SEMESTER transcripts');
                }
                const match = semesterSummaries.find((s) => s.semester === body.semester);
                if (!match) {
                    throw new ApiError(400, 'NO_PUBLISHED_RESULT', 'No published result for the requested semester');
                }
                sgpa = match.sgpa;
                semester = match.semester;
                academicYear = match.academicYear;
            }

            const year = new Date().getFullYear();
            const seq = await getNextSequence(db, 'transcript', 'transcriptNo', `TRN-${year}-`, tenant);
            const transcriptNo = `TRN-${year}-${String(seq).padStart(6, '0')}`;

            const created = await db.transcript.create({
                data: {
                    schoolId: tenant,
                    studentId: body.studentId,
                    transcriptNo,
                    type: body.type,
                    semester,
                    academicYear,
                    cgpa,
                    sgpa,
                },
            });

            return {
                id: created.id,
                studentId: created.studentId,
                studentName: `${student.firstName} ${student.lastName}`.trim(),
                transcriptNo: created.transcriptNo,
                issuedAt: created.issuedAt.toISOString(),
                semester: created.semester,
                academicYear: created.academicYear,
                type: created.type,
                cgpa: created.cgpa,
                sgpa: created.sgpa,
            };
        });

        return successResponse({ transcript }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
