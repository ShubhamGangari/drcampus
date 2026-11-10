import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { publishMeritSchema } from '@/lib/validators';

// Admins allowed to publish merit lists: school-level DEAN and central
// REGISTRAR_ADMIN. Tenant scoping is enforced by `withAuth` (schoolIdStorage)
// + the Prisma extension (findFirst/update scoped by schoolId).
const ADMIN_ROLES = ['REGISTRAR_ADMIN', 'DEAN'];

export const POST = withAuth(async (request, { user }) => {
  try {
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
    }

    const data = await validateBody(request, publishMeritSchema);

    const { publishedAt } = await withClient(user, async (db) => {
      // The publish action requires a generated merit list for this cycle+program
      // within the tenant. If generation never ran, there is no row to publish.
      const existing = await db.meritList.findFirst({
        where: {
          cycleId: data.cycleId,
          programId: data.programId,
        },
      });

      if (!existing) {
        throw new ApiError(
          404,
          'NOT_FOUND',
          'No generated merit list found for this cycle and program in this school'
        );
      }

      // Idempotent: publishing again simply refreshes publishedAt.
      const updated = await db.meritList.update({
        where: { id: existing.id },
        data: { publishedAt: new Date() },
      });

      return { publishedAt: updated.publishedAt };
    });

    return successResponse({
      published: true,
      publishedAt: publishedAt!.toISOString(),
      cycleId: data.cycleId,
      programId: data.programId,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
