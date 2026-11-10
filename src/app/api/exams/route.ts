import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createExamSchema } from '@/lib/exam-schemas';
import { resolveCreateTenant } from '@/lib/exam-core';
import { assertProgramBelongsToSchool } from '@/lib/fee-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const EXAM_CONTROLLER_ROLE = 'EXAM_CONTROLLER';
const LIST_ROLES = ['EXAM_CONTROLLER', 'DEAN', 'REGISTRAR_ADMIN', 'STUDENT'];

const EXAM_SELECT = {
  id: true,
  programId: true,
  academicYear: true,
  semester: true,
  type: true,
  title: true,
  maxInternal: true,
  maxExternal: true,
  status: true,
} as const;

// ---------------------------------------------------------------------------
// POST /api/exams — create an exam (EXAM_CONTROLLER). 201 { examId }
//   Central ('ALL') controllers must send body.schoolId; school-scoped ones
//   never do (it is ignored).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, EXAM_CONTROLLER_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Exam controller access required');
    }

    const body = await validateBody(request, createExamSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    return await withClient(user, async (db) => {
      // Central ('ALL') controllers must target an existing school. School-scoped
      // users resolve their own school, which trivially exists.
      if (user.schoolId === 'ALL') {
        const school = await db.school.findUnique({
          where: { id: tenant },
          select: { id: true },
        });
        if (!school) {
          throw new ApiError(
            400,
            'SCHOOL_NOT_FOUND',
            'Target school does not exist'
          );
        }
      }

      await assertProgramBelongsToSchool(db, body.programId, tenant);

      const exam = await db.exam.create({
        data: {
          schoolId: tenant,
          programId: body.programId,
          academicYear: body.academicYear,
          semester: body.semester,
          type: body.type,
          title: body.title,
          maxInternal: body.maxInternal,
          maxExternal: body.maxExternal,
          status: 'DRAFT',
        },
        select: { id: true },
      });

      return successResponse({ examId: exam.id }, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/exams — list exams.
//   Query: programId?, academicYear?, status?
//   Students only see PUBLISHED exams. Central controllers see across schools.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!LIST_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to exams');
    }

    const url = new URL(request.url);
    const where: Record<string, unknown> = {};

    const programId = url.searchParams.get('programId');
    const academicYear = url.searchParams.get('academicYear');
    const status = url.searchParams.get('status');
    if (programId) where.programId = programId;
    if (academicYear) where.academicYear = academicYear;
    if (status) where.status = status;
    if (user.role === 'STUDENT') where.status = 'PUBLISHED';

    return await withClient(user, async (db) => {
      const exams = await db.exam.findMany({
        where,
        select: EXAM_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      return successResponse(exams);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
