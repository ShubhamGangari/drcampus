import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { enrollStudentSchema } from '@/lib/student-schemas';
import { resolveCreateTenant, canEnrollStudent } from '@/lib/student-lifecycle';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

const ENROLL_ROLES = ['REGISTRAR_ADMIN'];

// ---------------------------------------------------------------------------
// POST /api/students/[id]/enroll — enroll a student for a year+semester.
// Body: { academicYear, semester } → 201 { enrollmentId } | 400 ALREADY_ENROLLED
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { params, user }) => {
  try {
    if (!ENROLL_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
    }

    const { id } = params;
    const data = await validateBody(request, enrollStudentSchema);

    // Resolve the concrete tenant for this create. School-scoped users are
    // pinned to their own school; central officers must pass a schoolId.
    const targetSchoolId = resolveCreateTenant(user, data.schoolId);

    const result = await withClient(user, async (db) => {
      // The student must exist and belong to the target school. Terminal states
      // (graduated / dropped) cannot be enrolled.
      const student = await db.student.findUnique({
        where: { id },
        select: { status: true, schoolId: true },
      });
      if (!student) {
        throw new ApiError(404, 'NOT_FOUND', 'Student not found');
      }
      if (student.schoolId !== targetSchoolId) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Student does not belong to the specified school');
      }
      if (!canEnrollStudent(student.status)) {
        throw new ApiError(400, 'CANNOT_ENROLL', 'Graduated or dropped students cannot be enrolled');
      }

      const existing = await db.enrollment.findFirst({
        where: { studentId: id, academicYear: data.academicYear, semester: data.semester },
      });
      if (existing) {
        throw new ApiError(400, 'ALREADY_ENROLLED', 'Student is already enrolled for this academic year and semester');
      }

      try {
        const enrollment = await db.enrollment.create({
          data: {
            studentId: id,
            academicYear: data.academicYear,
            semester: data.semester,
            schoolId: targetSchoolId,
          },
          select: { id: true },
        });

        await writeAuditLog(db, {
          schoolId: targetSchoolId,
          actorId: user.userId,
          action: 'STUDENT_ENROLLED',
          entityType: 'ENROLLMENT',
          entityId: enrollment.id,
          summary: `Enrolled student ${id} for ${data.academicYear} S${data.semester}`,
        });

        return enrollment;
      } catch (err) {
        const e = err as { code?: string } | null;
        if (e?.code === 'P2002') {
          throw new ApiError(400, 'ALREADY_ENROLLED', 'Student is already enrolled for this academic year and semester');
        }
        throw err;
      }
    });

    return successResponse({ enrollmentId: result.id }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
