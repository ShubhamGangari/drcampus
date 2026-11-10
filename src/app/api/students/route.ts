import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createStudentSchema } from '@/lib/student-schemas';
import { generateRollNo, findSelfStudent, resolveCreateTenant, isBatchProgramMismatch } from '@/lib/student-lifecycle';
import { writeAuditLog } from '@/lib/audit-writer';

/**
 * True when a Prisma unique-constraint error is specifically a rollNo
 * collision on the compound [schoolId, rollNo] unique index. A duplicate
 * email is pre-checked before insert, so any P2002 here is treated as a
 * rollNo collision unless a different target field is clearly named.
 */
function isRollNoCollision(err: unknown): boolean {
  const e = err as { code?: string; meta?: { target?: string | string[] } } | null;
  if (e?.code !== 'P2002') return false;
  const target = e?.meta?.target;
  if (target == null) return true;
  if (typeof target === 'string') return target.includes('rollNo');
  if (Array.isArray(target)) return target.some((f) => f === 'rollNo');
  return true;
}

export const dynamic = 'force-dynamic';

const CREATE_ROLES = ['REGISTRAR_ADMIN'];
const LIST_ROLES = ['REGISTRAR_ADMIN', 'FACULTY', 'STUDENT'];

const STUDENT_LIST_SELECT = {
  id: true,
  rollNo: true,
  firstName: true,
  lastName: true,
  email: true,
  programId: true,
  batchId: true,
  status: true,
} as const;

// ---------------------------------------------------------------------------
// POST /api/students — create a student (REGISTRAR_ADMIN).
// 201 { studentId, rollNo } | 409 duplicate email | 400 program/batch missing
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!CREATE_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar admin access required');
    }

    const data = await validateBody(request, createStudentSchema);

    // Resolve the concrete tenant for this create. School-scoped users are
    // pinned to their own school; central officers must pass a schoolId.
    const targetSchoolId = resolveCreateTenant(user, data.schoolId);

    const result = await withClient(user, async (db) => {
      const program = await db.program.findFirst({
        where: { id: data.programId },
        select: { id: true, code: true, schoolId: true },
      });
      if (!program) {
        throw new ApiError(400, 'PROGRAM_NOT_FOUND', 'Program not found');
      }
      if (program.schoolId !== targetSchoolId) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Program does not belong to the specified school');
      }

      const batch = await db.batch.findFirst({
        where: { id: data.batchId },
        select: { id: true, schoolId: true, programId: true },
      });
      if (!batch) {
        throw new ApiError(400, 'BATCH_NOT_FOUND', 'Batch not found');
      }
      if (batch.schoolId !== targetSchoolId) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Batch does not belong to the specified school');
      }
      if (batch.schoolId !== program.schoolId || isBatchProgramMismatch(batch.programId, program.id)) {
        throw new ApiError(400, 'BATCH_PROGRAM_MISMATCH', 'Batch does not belong to the selected program');
      }

      const existing = await db.student.findFirst({
        where: { email: data.email, schoolId: targetSchoolId },
      });
      if (existing) {
        throw new ApiError(409, 'DUPLICATE_EMAIL', 'A student with this email already exists');
      }

      // Per-school, per-program rollNo from the MAX existing numeric suffix
      // (never global COUNT). Retry on the compound unique constraint
      // ([schoolId, rollNo]) to cover races between concurrent creates.
      let created: { id: string; rollNo: string } | null = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        const rollNo = await generateRollNo(db, program, targetSchoolId);
        try {
          created = await db.student.create({
            data: {
              schoolId: targetSchoolId,
              rollNo,
              admissionId: data.admissionId,
              programId: program.id,
              batchId: batch.id,
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              phone: data.phone,
              dob: data.dob,
              gender: data.gender,
              category: data.category,
            },
            select: { id: true, rollNo: true },
          });
          break;
        } catch (err) {
          if (!isRollNoCollision(err)) throw err;
          // rollNo collision -> regenerate (max+1) and retry.
        }
      }

      if (!created) {
        throw new ApiError(500, 'ROLLNO_GENERATION_FAILED', 'Could not generate a unique roll number');
      }

      await writeAuditLog(db, {
        schoolId: targetSchoolId,
        actorId: user.userId,
        action: 'STUDENT_CREATED',
        entityType: 'STUDENT',
        entityId: created.id,
        summary: `Created student ${created.rollNo}`,
      });

      return created;
    });

    return successResponse({ studentId: result.id, rollNo: result.rollNo }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/students — list (REGISTRAR_ADMIN / FACULTY / STUDENT).
// Query: programId?, batchId?, status?, search? (name/rollNo/email, case-insensitive).
// Returns a bare array of student summaries. STUDENT sees only their own record.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!LIST_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Not authorized to view students');
    }

    const url = new URL(request.url);
    const programId = url.searchParams.get('programId');
    const batchId = url.searchParams.get('batchId');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    const students = await withClient(user, async (db) => {
      const where: Record<string, unknown> = {};
      if (programId) where.programId = programId;
      if (batchId) where.batchId = batchId;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { rollNo: { contains: search } },
          { email: { contains: search } },
        ];
      }

      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) return [];
        where.id = self.id;
      }

      return db.student.findMany({
        where,
        orderBy: [{ rollNo: 'asc' }],
        select: STUDENT_LIST_SELECT,
      });
    });

    return successResponse(students);
  } catch (error) {
    return errorResponse(error);
  }
});
