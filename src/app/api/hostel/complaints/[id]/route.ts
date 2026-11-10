import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateComplaintStatusSchema } from '@/lib/hostel-schemas';

export const dynamic = 'force-dynamic';

const MANAGER_ROLES = ['DEAN', 'REGISTRAR_ADMIN'] as const;

// ---------------------------------------------------------------------------
// PATCH /api/hostel/complaints/[id] — update complaint status.
// DEAN / REGISTRAR_ADMIN. Body { status }. 200 { id, status }
//   404 not found | 400 invalid status
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
  try {
    if (!MANAGER_ROLES.includes(user.role as (typeof MANAGER_ROLES)[number])) {
      throw new ApiError(403, 'FORBIDDEN', 'Dean or registrar access required');
    }

    const body = await validateBody(request, updateComplaintStatusSchema);
    const complaintId = params.id as string;

    const updated = await withClient(user, async (db) => {
      // complaintId is globally unique; the extended client auto-scopes school
      // users so an id from another tenant is simply not found.
      const complaint = await db.hostelComplaint.findUnique({
        where: { id: complaintId },
      });
      if (!complaint) {
        throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
      }

      return db.hostelComplaint.update({
        where: { id: complaintId },
        data: { status: body.status },
        select: { id: true, status: true },
      });
    });

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
});
