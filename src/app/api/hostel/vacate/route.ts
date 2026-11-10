import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { vacateSchema } from '@/lib/hostel-schemas';
import { resolveCreateTenant } from '@/lib/hostel-core';

export const dynamic = 'force-dynamic';

const MANAGER_ROLES = ['DEAN', 'REGISTRAR_ADMIN'] as const;

// ---------------------------------------------------------------------------
// POST /api/hostel/vacate — vacate an ACTIVE allocation.
// DEAN / REGISTRAR_ADMIN. 200 { vacated: true }
//   404 allocation not found | 400 not currently active
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!MANAGER_ROLES.includes(user.role as (typeof MANAGER_ROLES)[number])) {
      throw new ApiError(403, 'FORBIDDEN', 'Dean or registrar access required');
    }

    const body = await validateBody(request, vacateSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    await withClient(user, async (db) => {
      const allocation = await db.hostelAllocation.findUnique({
        where: {
          id: body.allocationId,
          ...(isCentralUser(user) ? { schoolId: tenant } : {}),
        },
      });
      if (!allocation) {
        throw new ApiError(404, 'NOT_FOUND', 'Allocation not found');
      }
      if (allocation.vacatedAt) {
        throw new ApiError(400, 'INVALID_STATE', 'Allocation is already vacated');
      }

      await db.hostelAllocation.update({
        where: { id: body.allocationId },
        data: { vacatedAt: new Date() },
      });
    });

    return successResponse({ vacated: true });
  } catch (error) {
    return errorResponse(error);
  }
});
