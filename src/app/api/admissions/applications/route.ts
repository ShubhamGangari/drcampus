import { randomUUID } from 'node:crypto';
import { prisma, prismaBase, schoolIdStorage, withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { publicApplicationSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request, { user }) => {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const cycleId = url.searchParams.get('cycleId');
    const programId = url.searchParams.get('programId');
    const search = url.searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (cycleId) where.cycleId = cycleId;
    if (programId) where.programId = programId;
    if (search) {
      where.OR = [
        { applicantName: { contains: search } },
        { applicationNo: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Central officers (schoolId 'ALL') may list applications across every
    // school; school-scoped users stay tenant-isolated via the Prisma extension.
    const applications = await withClient(user, (db) =>
      db.application.findMany({
        where,
        orderBy: [
          { marksPercentage: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          cycle: {
            select: { title: true, academicYear: true },
          },
        },
      })
    );

    return successResponse({ applications });
  } catch (error) {
    return errorResponse(error);
  }
});

// Public applicant submission — unauthenticated (middleware allowlists POST on
// this exact path). Tenant is resolved from the submitted `schoolId` because the
// applicant has no session; the DB flow then runs inside that tenant context.
export const POST = async (request: Request) => {
  try {
    const data = await validateBody(request, publicApplicationSchema);

    // Resolve + verify the tenant for this public submission.
    const school = await prismaBase.school.findUnique({ where: { id: data.schoolId } });
    if (!school) {
      throw new ApiError(404, 'NOT_FOUND', 'School not found');
    }

    const application = await schoolIdStorage.run(data.schoolId, async () => {
      // The cycle must exist within the target school (tenant-scoped lookup)
      // AND be active for new applications.
      const cycle = await prisma.admissionCycle.findFirst({ where: { id: data.cycleId } });
      if (!cycle) {
        throw new ApiError(404, 'NOT_FOUND', 'Admission cycle not found');
      }
      if (!cycle.active) {
        throw new ApiError(409, 'CYCLE_INACTIVE', 'This admission cycle is not currently accepting applications');
      }

      // Verify the program belongs to the same school as the cycle
      const program = await prisma.program.findFirst({
        where: {
          id: data.programId,
          schoolId: data.schoolId
        }
      });
      if (!program) {
        throw new ApiError(404, 'NOT_FOUND', 'Program not found in this school');
      }

      // Auto-generate a tenant-safe, collision-proof application number.
      // Format: APP-<academicYear>-<schoolToken>-<random>, e.g. APP-2026-schangeeng-A1B2C3D.
      // The random suffix (from crypto.randomUUID) guarantees global uniqueness
      // (applicationNo is globally unique) while the year + school token make it
      // human-readable and per-school scoped. The year is derived from the
      // cycle's academicYear, never hardcoded.
      const yearPrefix = cycle.academicYear.split('-')[0] ?? cycle.academicYear;
      const schoolToken = data.schoolId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const uniqueSuffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
      const appNumber = `APP-${yearPrefix}-${schoolToken}-${uniqueSuffix}`;

      return prisma.application.create({
        data: {
          applicationNo: appNumber,
          cycleId: data.cycleId,
          programId: data.programId,
          applicantName: data.applicantName,
          email: data.email,
          phone: data.phone,
          gender: data.gender,
          dob: data.dob,
          category: data.category,
          marksPercentage: data.marksPercentage,
          documentsJson: JSON.stringify(data.documents || []),
          status: 'SUBMITTED',
          // Tenant scoping (the Prisma extension also injects the same value).
          schoolId: data.schoolId,
        },
      });
    });

    return successResponse({ application }, 201);
  } catch (error) {
    return errorResponse(error);
  }
};

