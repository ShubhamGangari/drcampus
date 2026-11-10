import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, ApiError } from '@/lib/api';
import { findSelfStudent } from '@/lib/alumni-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/alumni/me — a STUDENT (alumni) reads their own record.
// 200 { id, studentId, studentName, batch, email, phone, currentCompany, createdAt }
// 403 not a student | 404 no alumni record for the current student.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_request, { user }) => {
  if (!guardRole(user.role, 'STUDENT')) {
    throw new ApiError(403, 'FORBIDDEN', 'Students only');
  }

  return withClient(user, async (db) => {
    const self = await findSelfStudent(db, user);
    if (!self) {
      throw new ApiError(404, 'ALUMNI_NOT_FOUND', 'No alumni record for this student');
    }

    const alumni = await db.alumni.findFirst({
      where: { studentId: self.id },
    });
    if (!alumni) {
      throw new ApiError(404, 'ALUMNI_NOT_FOUND', 'No alumni record for this student');
    }

    return successResponse({
      id: alumni.id,
      studentId: alumni.studentId,
      studentName: `${self.firstName ?? ''} ${self.lastName ?? ''}`.trim(),
      batch: alumni.batch ?? null,
      email: alumni.email,
      phone: alumni.phone ?? null,
      currentCompany: alumni.currentCompany ?? null,
      createdAt: alumni.createdAt,
    });
  });
});
