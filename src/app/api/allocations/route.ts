import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createAllocationSchema } from '@/lib/validators';
import { requirePermission, getActingUser, isSemesterValid } from '@/lib/org';

export const dynamic = 'force-dynamic';

/**
 * Ownership check for courseâ€“faculty allocations:
 * - REGISTRAR_ADMIN may allocate anywhere.
 * - HOD may only allocate within their own department.
 * - PROGRAM_COORDINATOR may only allocate for the program they coordinate.
 */
interface ActingUserShape {
  id: string;
  role: string;
  schoolId: string;
  position: string | null;
  departmentId: string | null;
}

interface ClassGroupShape {
  programId: string | null;
  program: { coordinatorUserId: string | null } | null;
}

async function assertCanAllocate(me: ActingUserShape, classGroup: ClassGroupShape) {
  if (me.role === 'REGISTRAR_ADMIN') return;
  if (me.position === 'HOD') {
    if (!me.departmentId) {
      throw new ApiError(403, 'FORBIDDEN', 'HOD must be attached to a department to allocate courses');
    }
    return;
  }
  if (me.position === 'PROGRAM_COORDINATOR') {
    if (classGroup.programId && classGroup.program?.coordinatorUserId !== me.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Program coordinator may only allocate for their own program');
    }
    return;
  }
  throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to allocate courses');
}

export const GET = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.view');

    const { searchParams } = new URL(request.url);
    const where: Record<string, unknown> = {};
    if (isCentralUser(user)) {
      // Central users (schoolId 'ALL') may view all schools, optionally filtered.
      const schoolId = searchParams.get('schoolId');
      if (schoolId) where.schoolId = schoolId;
    } else {
      // Non-central users are always scoped to their own school.
      where.schoolId = me.schoolId;
    }
    if (searchParams.get('departmentId')) where.departmentId = searchParams.get('departmentId');
    if (searchParams.get('classGroupId')) where.classGroupId = searchParams.get('classGroupId');
    if (searchParams.get('facultyUserId')) where.facultyUserId = searchParams.get('facultyUserId');

    const allocations = await withClient(user, (db) =>
      db.facultyAllocation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { id: true, code: true, title: true } },
          classGroup: {
            select: {
              id: true,
              section: true,
              program: { select: { id: true, name: true, code: true } },
              batch: { select: { id: true, name: true } },
            },
          },
          faculty: { select: { id: true, name: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      })
    );

    const items = allocations.map((a) => ({
      id: a.id,
      schoolId: a.schoolId,
      departmentId: a.departmentId,
      courseId: a.courseId,
      classGroupId: a.classGroupId,
      facultyUserId: a.facultyUserId,
      semester: a.semester,
      academicYear: a.academicYear,
      course: a.course,
      classGroup: a.classGroup,
      faculty: a.faculty,
      department: a.department ?? null,
      createdAt: a.createdAt,
    }));

    return successResponse({ items });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'org.allocate_course');

    const data = await validateBody(request, createAllocationSchema);
    if (!isSemesterValid(data.semester)) {
      throw new ApiError(400, 'INVALID_SEMESTER', 'Semester must be a positive integer');
    }

    let targetSchoolId = user.schoolId;
    if (isCentralUser(user) && data.schoolId) {
      targetSchoolId = data.schoolId;
    } else if (data.schoolId && data.schoolId !== user.schoolId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot create an allocation for another school');
    }

    const [course, classGroup, faculty] = await withClient(user, async (db) => {
      const c = await db.course.findUnique({ where: { id: data.courseId } });
      const g = await db.classGroup.findUnique({
        where: { id: data.classGroupId },
        include: { program: { select: { id: true, coordinatorUserId: true } } },
      });
      const f = await db.user.findUnique({
        where: { id: data.facultyUserId },
        select: { id: true, role: true },
      });
      return [c, g, f] as const;
    });

    if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
    if (!classGroup) throw new ApiError(404, 'NOT_FOUND', 'Class group not found');
    // Central officers may omit schoolId; infer it from the class group.
    if (isCentralUser(user) && !data.schoolId) {
      targetSchoolId = classGroup.schoolId;
    }
    if (!faculty || faculty.role !== 'FACULTY') {
      throw new ApiError(400, 'INVALID_FACULTY', 'Faculty must be a FACULTY-based user');
    }
    if (course.schoolId !== targetSchoolId || classGroup.schoolId !== targetSchoolId) {
      throw new ApiError(400, 'INVALID_SCHOOL', 'Course/class group do not belong to the target school');
    }

    await assertCanAllocate(me, classGroup);

    let departmentId: string | null = data.departmentId ?? null;
    if (me.position === 'HOD') {
      if (data.departmentId && data.departmentId !== me.departmentId) {
        throw new ApiError(403, 'FORBIDDEN', 'HOD may only allocate within their own department');
      }
      departmentId = me.departmentId;
    }

    const dup = await withClient(user, (db) =>
      db.facultyAllocation.findFirst({
        where: {
          courseId: data.courseId,
          classGroupId: data.classGroupId,
          semester: data.semester,
          academicYear: data.academicYear,
        },
      })
    );
    if (dup) {
      throw new ApiError(409, 'ALLOCATION_EXISTS', 'A course already allocated to this class/semester/academic year');
    }

    const allocation = await withClient(user, (db) =>
      db.facultyAllocation.create({
        data: {
          schoolId: targetSchoolId,
          departmentId,
          courseId: data.courseId,
          classGroupId: data.classGroupId,
          facultyUserId: data.facultyUserId,
          semester: data.semester,
          academicYear: data.academicYear,
        },
      })
    );

    return successResponse(allocation, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
