import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { graduateStudentSchema } from '@/lib/student-schemas';
import { isGraduateEligible } from '@/lib/student-lifecycle';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

const GRADUATE_ROLES = ['REGISTRAR_ADMIN'];

// ---------------------------------------------------------------------------
// POST /api/students/[id]/graduate — mark a student graduated (REGISTRAR_ADMIN).
// Body (optional): { graduationDate?: YYYY-MM-DD, degreeAwarded?: string }.
// Eligibility: ACTIVE + has ≥1 enrollment + not already graduated, else
// 400 INELIGIBLE. Persists graduationDate/degreeAwarded, sets status GRADUATED.
// → 200 { studentId, status: "GRADUATED", graduationDate, degreeAwarded }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { params, user }) => {
  try {
    if (!GRADUATE_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
    }

    const { id } = params;

    // The body is optional (an empty request is valid). Parse it safely so a
    // missing/empty body does not fail JSON parsing.
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // no body → defaults to {}
    }
    const data = graduateStudentSchema.parse(body);

    const result = await withClient(user, async (db) => {
      const student = await db.student.findUnique({ where: { id } });
      if (!student) {
        throw new ApiError(404, 'NOT_FOUND', 'Student not found');
      }

      const enrollmentCount = await db.enrollment.count({ where: { studentId: id } });
      if (!isGraduateEligible(student, enrollmentCount > 0)) {
        throw new ApiError(
          400,
          'INELIGIBLE',
          'Only an active student with at least one enrollment can be graduated'
        );
      }

      const updated = await db.student.update({
        where: { id },
        data: {
          status: 'GRADUATED',
          ...(data.graduationDate ? { graduationDate: new Date(data.graduationDate) } : {}),
          ...(data.degreeAwarded ? { degreeAwarded: data.degreeAwarded } : {}),
        },
        select: { id: true, status: true, graduationDate: true, degreeAwarded: true },
      });

      await writeAuditLog(db, {
        schoolId: student.schoolId,
        actorId: user.userId,
        action: 'STUDENT_GRADUATED',
        entityType: 'STUDENT',
        entityId: id,
        summary: `Graduated student ${updated.id}`,
      });

      return {
        studentId: updated.id,
        status: updated.status,
        graduationDate: updated.graduationDate ? new Date(updated.graduationDate).toISOString() : null,
        degreeAwarded: updated.degreeAwarded ?? null,
      };
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
