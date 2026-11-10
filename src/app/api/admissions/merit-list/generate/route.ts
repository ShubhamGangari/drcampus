import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { generateMeritSchema } from '@/lib/validators';
import { computeMeritRanks } from '@/lib/merit';

// Admins allowed to generate merit lists: school-level DEAN and central
// REGISTRAR_ADMIN. Tenant scoping is enforced by `withAuth`
// (schoolIdStorage) + the Prisma extension, so cross-tenant data is never
// visible regardless of role.
const ADMIN_ROLES = ['REGISTRAR_ADMIN', 'DEAN'];

export const POST = withAuth(async (request, { user }) => {
  try {
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
    }

    const data = await validateBody(request, generateMeritSchema);

    // Only eligible applications are ranked: VERIFIED and SHORTLISTED.
    // SUBMITTED (still being processed) and REJECTED are excluded.
    const ELIGIBLE_STATUSES = ['VERIFIED', 'SHORTLISTED'];

    const { cycle, applications } = await withClient(user, async (db) => {
      // Verify the cycle belongs to this tenant (scoped; cross-tenant -> 404).
      const foundCycle = await db.admissionCycle.findFirst({ where: { id: data.cycleId } });
      if (!foundCycle) {
        throw new ApiError(404, 'NOT_FOUND', 'Admission cycle not found');
      }

      // The program must exist and belong to the same school as the cycle.
      // This prevents a bogus or foreign programId from writing an empty
      // (or cross-tenant) merit row.
      const foundProgram = await db.program.findFirst({
        where: { id: data.programId, schoolId: foundCycle.schoolId },
      });
      if (!foundProgram) {
        throw new ApiError(404, 'NOT_FOUND', 'Program not found');
      }

      const foundApplications = await db.application.findMany({
        where: {
          cycleId: data.cycleId,
          programId: data.programId,
          status: { in: ELIGIBLE_STATUSES },
        },
        select: { id: true, marksPercentage: true, dob: true },
      });

      return { cycle: foundCycle, applications: foundApplications };
    });

    const ranked = computeMeritRanks(applications);

    // Persist merit ranks on each application AND upsert the MeritList row
    await withClient(user, async (db) => {
      for (const entry of ranked) {
        await db.application.update({
          where: { id: entry.id },
          data: { meritRank: entry.meritRank },
        });
      }

      // Upsert the MeritList row for this cycle+program combination
      await db.meritList.upsert({
        where: {
          cycleId_programId: {
            cycleId: data.cycleId,
            programId: data.programId,
          },
        },
        create: {
          // Derive tenant from the cycle. Required for central officers who use
          // the base client (no auto-injection); for scoped clients this matches
          // the injected schoolId anyway.
          schoolId: cycle.schoolId,
          cycleId: data.cycleId,
          programId: data.programId,
          totalRanked: ranked.length,
          publishedAt: null,
        },
        update: {
          schoolId: cycle.schoolId,
          totalRanked: ranked.length,
          publishedAt: null, // Reset publishedAt on regenerate
        },
      });
    });

    return successResponse({
      totalRanked: ranked.length,
      programId: data.programId,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
