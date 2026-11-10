import { NextResponse } from 'next/server';
import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { requirePermission, getActingUser } from '@/lib/org';
import { createSlotSchema } from '@/lib/academic-schemas';
import { resolveCreateTenant, requireManageSlot, detectSlotConflicts } from '@/lib/academic-core';

export const dynamic = 'force-dynamic';

const SLOT_INCLUDE = {
  course: true,
  faculty: { select: { id: true, name: true, email: true } },
  classGroup: { select: { id: true, section: true, programId: true, batchId: true } },
} as const;

// ---------------------------------------------------------------------------
// GET /api/academic/timetable — list slots. Staff list across a class group;
// students must specify a classGroupId (their own class). 200 { items }.
// Query: ?classGroupId=&schoolId=(central)&dayOfWeek=&semester=&academicYear=
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'timetable.view');

    const { searchParams } = new URL(request.url);
    const where: Record<string, unknown> = {};

    if (isCentralUser(user)) {
      const schoolId = searchParams.get('schoolId');
      if (schoolId) where.schoolId = schoolId;
    }

    const classGroupId = searchParams.get('classGroupId');
    if (classGroupId) where.classGroupId = classGroupId;

    // Students may only read a timetable for a specified class group (their own
    // class). The tenant scoping below still restricts them to their school.
    if (me.role === 'STUDENT' && !classGroupId) {
      throw new ApiError(400, 'CLASS_GROUP_REQUIRED', 'Students must specify classGroupId');
    }

    const dayOfWeek = searchParams.get('dayOfWeek');
    if (dayOfWeek) where.dayOfWeek = Number(dayOfWeek);

    const semester = searchParams.get('semester');
    if (semester) where.semester = Number(semester);

    const academicYear = searchParams.get('academicYear');
    if (academicYear) where.academicYear = academicYear;

    const items = await withClient(user, (db) =>
      db.timetableSlot.findMany({
        where,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: SLOT_INCLUDE,
      })
    );

    return successResponse({ items });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/academic/timetable — create slot (timetable.manage). On conflict →
// 409 TIMETABLE_CONFLICT with { conflicts }. Else 201 full row.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'timetable.manage');

    const body = await validateBody(request, createSlotSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    return await withClient(user, async (db) => {
      if (isCentralUser(user)) {
        const school = await db.school.findUnique({ where: { id: tenant }, select: { id: true } });
        if (!school) throw new ApiError(404, 'NOT_FOUND', 'School not found');
      }

      // Load and validate the class group (must belong to the tenant + provide
      // ownership context).
      const classGroup = await db.classGroup.findUnique({
        where: { id: body.classGroupId },
        include: { program: { select: { coordinatorUserId: true } } },
      });
      if (!classGroup) throw new ApiError(404, 'NOT_FOUND', 'Class group not found');
      if (classGroup.schoolId !== tenant) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Class group does not belong to this school');
      }
      requireManageSlot(me, { classGroup });

      // Course must exist and belong to the same school.
      const course = await db.course.findUnique({
        where: { id: body.courseId },
        select: { id: true, schoolId: true },
      });
      if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
      if (course.schoolId !== tenant) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Course does not belong to this school');
      }

      // Faculty must be a FACULTY-role user in the same school.
      const faculty = await db.user.findUnique({
        where: { id: body.facultyUserId },
        select: { id: true, schoolId: true, role: true },
      });
      if (!faculty) throw new ApiError(404, 'NOT_FOUND', 'Faculty user not found');
      if (faculty.schoolId !== tenant) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Faculty does not belong to this school');
      }
      if (faculty.role !== 'FACULTY') {
        throw new ApiError(400, 'INVALID_FACULTY', 'Assigned user must hold a FACULTY role');
      }

      // Conflict detection on the same day (tenant-scoped).
      const existingSlots = await db.timetableSlot.findMany({
        where: { dayOfWeek: body.dayOfWeek, ...(isCentralUser(user) ? { schoolId: tenant } : {}) },
        select: {
          id: true,
          classGroupId: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          facultyUserId: true,
          room: true,
        },
      });

      const conflicts = detectSlotConflicts(body, existingSlots);
      if (conflicts.length > 0) {
        return NextResponse.json({ conflicts }, { status: 409 });
      }

      const row = await db.timetableSlot.create({
        data: {
          schoolId: tenant,
          classGroupId: body.classGroupId,
          dayOfWeek: body.dayOfWeek,
          startTime: body.startTime,
          endTime: body.endTime,
          courseId: body.courseId,
          facultyUserId: body.facultyUserId,
          room: body.room ?? null,
          semester: body.semester,
          academicYear: body.academicYear,
        },
        include: SLOT_INCLUDE,
      });

      return successResponse(row, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
