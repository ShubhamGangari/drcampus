import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateStudentSchema } from '@/lib/student-schemas';
import { findSelfStudent, buildStudentHistory } from '@/lib/student-lifecycle';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

const VIEW_ROLES = ['REGISTRAR_ADMIN', 'FACULTY', 'STUDENT'];
const UPDATE_ROLES = ['REGISTRAR_ADMIN'];

const DETAIL_INCLUDE = {
  enrollments: { orderBy: [{ academicYear: 'asc' as const }, { semester: 'asc' as const }] },
  leaveRequests: { orderBy: [{ requestedAt: 'desc' as const }] },
  transferRequests: { orderBy: [{ requestedAt: 'desc' as const }] },
};

interface StudentDetailRow {
  id: string;
  rollNo: string;
  firstName: string;
  lastName: string;
  email: string;
  programId: string | null;
  batchId: string | null;
  status: string;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  category: string | null;
  admissionDate: Date | null;
  enrollments: Array<{
    id: string;
    academicYear: string;
    semester: number | string;
    createdAt?: string | Date | null;
  }>;
  leaveRequests: Array<{
    id: string;
    status: string;
    type: string;
    requestedAt?: string | Date | null;
  }>;
  transferRequests: Array<{
    id: string;
    status: string;
    toProgramId: string;
    requestedAt?: string | Date | null;
  }>;
}

function toDetail(student: StudentDetailRow) {
  return {
    id: student.id,
    rollNo: student.rollNo,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    programId: student.programId,
    batchId: student.batchId,
    status: student.status,
    phone: student.phone,
    dob: student.dob,
    gender: student.gender,
    category: student.category,
    admissionDate: student.admissionDate ? new Date(student.admissionDate).toISOString() : null,
    enrollments: student.enrollments ?? [],
    leaveRequests: student.leaveRequests ?? [],
    transferRequests: student.transferRequests ?? [],
    history: buildStudentHistory(student),
  };
}

// ---------------------------------------------------------------------------
// GET /api/students/[id] — full detail (REGISTRAR_ADMIN / FACULTY / STUDENT-self)
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { params, user }) => {
  try {
    if (!VIEW_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Not authorized to view this student');
    }

    const { id } = params;

    const student = await withClient(user, async (db) => {
      const found = await db.student.findUnique({
        where: { id },
        include: DETAIL_INCLUDE,
      });
      if (!found) {
        throw new ApiError(404, 'NOT_FOUND', 'Student not found');
      }
      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self || self.id !== found.id) {
          throw new ApiError(403, 'FORBIDDEN', 'Students may only view their own record');
        }
      }
      return found;
    });

    return successResponse(toDetail(student));
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/students/[id] — update (REGISTRAR_ADMIN).
// Body: firstName? / lastName? / email? / phone? / status? → 200 full detail.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { params, user }) => {
  try {
    if (!UPDATE_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
    }

    const { id } = params;
    const data = await validateBody(request, updateStudentSchema);

    const updated = await withClient(user, async (db) => {
      const existing = await db.student.findUnique({ where: { id } });
      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Student not found');
      }

      if (data.email && data.email !== existing.email) {
        const clash = await db.student.findFirst({
          where: { email: data.email, NOT: { id } },
        });
        if (clash) {
          throw new ApiError(409, 'DUPLICATE_EMAIL', 'Another student already uses this email');
        }
      }

      const allowed = { firstName: true, lastName: true, email: true, phone: true, status: true };
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (allowed[k as keyof typeof allowed] && v !== undefined) patch[k] = v;
      }

      const result = await db.student.update({
        where: { id },
        data: patch,
        include: DETAIL_INCLUDE,
      });

      await writeAuditLog(db, {
        schoolId: existing.schoolId,
        actorId: user.userId,
        action: 'STUDENT_UPDATED',
        entityType: 'STUDENT',
        entityId: id,
        summary: `Updated student ${result.rollNo ?? id}`,
      });

      return result;
    });

    return successResponse(toDetail(updated));
  } catch (error) {
    return errorResponse(error);
  }
});
