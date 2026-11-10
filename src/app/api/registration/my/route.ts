import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    validateBody,
    errorResponse,
    ApiError,
} from '@/lib/api';
import { registerCoursesSchema } from '@/lib/registration-schemas';
import {
    resolveCreateTenant,
    tenantFilter,
    findSelfStudent,
    isWindowOpen,
    validateCreditCap,
} from '@/lib/registration-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/registration/my
// Lists the logged-in student's own registrations. Self-service. 200
// { registrations: [{ id, courseId, code, title, credits, semester,
//                      academicYear, status }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const registrations = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const rows = await db.courseRegistration.findMany({
                where: {
                    ...tenantFilter(isCentralUser(user), schoolId),
                    studentId: self.id,
                },
                orderBy: { createdAt: 'desc' },
            });

            const courseIds = Array.from(new Set(rows.map((r) => r.courseId)));
            const courses = courseIds.length
                ? await db.course.findMany({
                    where: { id: { in: courseIds } },
                    select: { id: true, code: true, title: true, credits: true },
                })
                : [];
            const courseMap = new Map(courses.map((c) => [c.id, c]));

            return rows.map((r) => ({
                id: r.id,
                courseId: r.courseId,
                code: courseMap.get(r.courseId)?.code ?? null,
                title: courseMap.get(r.courseId)?.title ?? null,
                credits: courseMap.get(r.courseId)?.credits ?? null,
                semester: r.semester,
                academicYear: r.academicYear,
                status: r.status,
            }));
        });

        return successResponse({ registrations });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/registration/my — register for courses (self-service).
// Requires an open window. 201 { registrations }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        const body = await validateBody(request, registerCoursesSchema);

        const registrations = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            if (!self) {
                throw new ApiError(404, 'NOT_FOUND', 'No student profile is linked to this account');
            }

            const tenant = resolveCreateTenant(user, body.schoolId);

            // Find an open registration window.
            const windows = await db.courseRegistrationWindow.findMany({
                where: { schoolId: tenant, active: true },
            });
            const open = windows.filter((w) => isWindowOpen(w));
            if (open.length === 0) {
                throw new ApiError(400, 'WINDOW_CLOSED', 'No registration window is currently open');
            }
            const window = open[0];

            // Load the requested courses (must all exist).
            const courses = await db.course.findMany({
                where: { id: { in: body.courseIds } },
            });
            if (courses.length !== body.courseIds.length) {
                throw new ApiError(400, 'INVALID_COURSES', 'One or more courses were not found');
            }
            const creditOf = new Map(courses.map((c) => [c.id, c.credits]));

            // Existing REGISTERED registrations for this window.
            const existing = await db.courseRegistration.findMany({
                where: {
                    schoolId: tenant,
                    studentId: self.id,
                    semester: window.semester,
                    academicYear: window.academicYear,
                    status: 'REGISTERED',
                },
            });
            const existingCourseIds = new Set(existing.map((e) => e.courseId));

            // Duplicate guard.
            for (const id of body.courseIds) {
                if (existingCourseIds.has(id)) {
                    throw new ApiError(409, 'DUPLICATE_REGISTRATION', 'Already registered for one of the selected courses');
                }
            }

            // Credit-cap guard (24 credits).
            const currentCredits = existing.reduce((sum, e) => sum + (creditOf.get(e.courseId) ?? 0), 0);
            const addedCredits = body.courseIds.reduce((sum, id) => sum + (creditOf.get(id) ?? 0), 0);
            if (!validateCreditCap(currentCredits, addedCredits)) {
                throw new ApiError(400, 'CREDIT_LIMIT_EXCEEDED', 'Registration would exceed the maximum credits per semester');
            }

            // Elective seat-cap guard.
            for (const course of courses) {
                if (course.type !== 'ELECTIVE') continue;
                const filled = await db.courseRegistration.count({
                    where: { schoolId: tenant, courseId: course.id, status: { not: 'DROPPED' } },
                });
                if (filled >= course.seatsTotal) {
                    throw new ApiError(409, 'SEAT_LIMIT_EXCEEDED', `Elective ${course.code} is full`);
                }
            }

            const created = await db.$transaction(
                body.courseIds.map((courseId) =>
                    db.courseRegistration.create({
                        data: {
                            schoolId: tenant,
                            courseId,
                            studentId: self.id,
                            semester: window.semester,
                            academicYear: window.academicYear,
                            status: 'REGISTERED',
                        },
                    })
                )
            );

            return created.map((r) => ({
                id: r.id,
                courseId: r.courseId,
                code: creditOf.has(r.courseId) ? courses.find((c) => c.id === r.courseId)?.code : null,
                title: creditOf.has(r.courseId) ? courses.find((c) => c.id === r.courseId)?.title : null,
                credits: creditOf.get(r.courseId) ?? null,
                semester: r.semester,
                academicYear: r.academicYear,
                status: r.status,
            }));
        });

        return successResponse({ registrations }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});
