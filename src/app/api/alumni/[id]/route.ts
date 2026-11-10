import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateAlumniSchema } from '@/lib/alumni-schemas';
import { findSelfStudent } from '@/lib/alumni-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/alumni/[id] — update email/phone/currentCompany/batch.
// REGISTRAR_ADMIN (any record) | STUDENT (own record only).
// Body { email?, phone?, currentCompany?, batch? } -> 200 { id }.
// 404 not found | 403 not owner/staff.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, 'REGISTRAR_ADMIN', 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar or alumni access required');
    }

    const body = await validateBody(request, updateAlumniSchema);
    const alumniId = params.id as string;

    await withClient(user, async (db) => {
      // studentId is globally unique; the extended client auto-scopes school
      // users so a cross-tenant id is simply not found -> 404.
      const alumni = await db.alumni.findUnique({
        where: { id: alumniId },
        select: { id: true, studentId: true, email: true, phone: true, currentCompany: true, batch: true },
      });
      if (!alumni) {
        throw new ApiError(404, 'NOT_FOUND', 'Alumni record not found');
      }

      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self || self.id !== alumni.studentId) {
          throw new ApiError(403, 'FORBIDDEN', 'You can only edit your own alumni profile');
        }
      }

      await db.alumni.update({
        where: { id: alumniId },
        data: {
          email: body.email ?? alumni.email,
          phone: body.phone ?? alumni.phone,
          currentCompany: body.currentCompany ?? alumni.currentCompany,
          batch: body.batch ?? alumni.batch,
        },
      });
    });

    return successResponse({ id: alumniId });
  } catch (error) {
    return errorResponse(error);
  }
});
