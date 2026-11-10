import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { z } from 'zod';

const statusSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'SHORTLISTED', 'ADMITTED']),
  remarks: z.string().max(500).optional(),
});

// Only registrar admins (central) and deans (school-level) may move an
// application through the pipeline. Mirrors the merit/seat routes.
const ADMIN_ROLES = ['REGISTRAR_ADMIN', 'DEAN'];

// Legal status transitions. REJECTED / ADMITTED are terminal (no out-edges).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['ADMITTED', 'REJECTED'],
  REJECTED: [],
  ADMITTED: [],
};

export const PATCH = withAuth(async (request, { params, user }) => {
  try {
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
    }

    const { id } = params;
    const data = await validateBody(request, statusSchema);

    const { updated } = await withClient(user, async (db) => {
      const current = await db.application.findUnique({
        where: { id },
      });

      if (!current) {
        throw new ApiError(404, 'NOT_FOUND', 'Application not found');
      }

      // Legal-transition guard. Reject any invalid move with a 409.
      const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(data.status)) {
        throw new ApiError(
          409,
          'INVALID_TRANSITION',
          `Cannot transition application from '${current.status}' to '${data.status}'`
        );
      }

      const result = await db.application.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.remarks !== undefined && { remarks: data.remarks }),
        },
      });

      return { updated: result };
    });

    return successResponse({ id: updated.id, status: updated.status, remarks: updated.remarks });
  } catch (error) {
    return errorResponse(error);
  }
});
