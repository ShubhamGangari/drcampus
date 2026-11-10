import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { allocateSeatSchema } from '@/lib/validators';

const SEAT_ELIGIBLE_STATUSES = ['SHORTLISTED', 'ADMITTED'];

// Admins allowed to allocate seats: school-level DEAN and central
// REGISTRAR_ADMIN. Tenant scoping is enforced by `withAuth` (schoolIdStorage)
// + the Prisma extension (findFirst/update scoped by schoolId).
const ADMIN_ROLES = ['REGISTRAR_ADMIN', 'DEAN'];

export const POST = withAuth(async (request, { user }) => {
  try {
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
    }

    const data = await validateBody(request, allocateSeatSchema);

    const { updated } = await withClient(user, async (db) => {
      const application = await db.application.findFirst({
        where: { id: data.applicationId, programId: data.programId },
      });

      if (!application) {
        throw new ApiError(404, 'NOT_FOUND', 'Application not found');
      }

      if (!SEAT_ELIGIBLE_STATUSES.includes(application.status)) {
        throw new ApiError(
          409,
          'INVALID_STATE',
          'Application is not eligible for seat allocation (must be shortlisted or admitted)'
        );
      }

      if (application.seatAllocated) {
        throw new ApiError(409, 'ALREADY_ALLOCATED', 'Seat is already allocated for this application');
      }

      // Capacity enforcement: count already-allocated seats for this program
      // (tenant-scoped) within the same admission cycle and compare against the
      // program's intake. If at/over capacity, block with QUOTA_FULL.
      const program = await db.program.findFirst({
        where: { id: data.programId },
      });
      if (!program) {
        throw new ApiError(404, 'PROGRAM_NOT_FOUND', 'Program not found');
      }

      const allocatedCount = await db.application.count({
        where: {
          programId: data.programId,
          cycleId: application.cycleId,
          seatAllocated: true,
        },
      });

      if (allocatedCount >= program.currentIntake) {
        throw new ApiError(
          409,
          'QUOTA_FULL',
          `Seat quota for this program is full (intake ${program.currentIntake})`
        );
      }

      const year = new Date().getFullYear();
      const random5 = Math.floor(10000 + Math.random() * 90000); // 5 digits
      const provisionalRollNo = `PROV-${year}-${random5}`;

      const result = await db.application.update({
        where: { id: application.id },
        data: {
          seatAllocated: true,
          provisionalRollNo,
          quotaCategory: data.quotaCategory,
          status: 'ADMITTED',
        },
      });

      return { updated: result };
    });

    return successResponse({
      applicationId: updated.id,
      seatAllocated: true,
      provisionalRollNo: updated.provisionalRollNo,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
