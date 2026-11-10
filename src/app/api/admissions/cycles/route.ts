import { prismaBase, withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { z } from 'zod';
import { admissionCycleSchema } from '@/lib/validators';

export const GET = withAuth(async (request, { user }) => {
  try {
    // Central officers see cycles across every school; school users are
    // tenant-isolated by the Prisma extension.
    const cycles = await withClient(user, (db) =>
      db.admissionCycle.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { applications: true },
          },
        },
      })
    );

    return successResponse({ cycles });
  } catch (error) {
    return errorResponse(error);
  }
});

// Admins allowed to create cycles: school-level DEAN and central
// REGISTRAR_ADMIN. Tenant scoping is enforced by `withAuth`
// (schoolIdStorage) + the Prisma extension.
const ADMIN_ROLES = ['REGISTRAR_ADMIN', 'DEAN'];

export const POST = withAuth(async (request, { user }) => {
  try {
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
    }

    const data = await validateBody(request, admissionCycleSchema.extend({
      schoolId: z.string().optional(),
    }));

    // Central officers must specify a target schoolId in the body
    let targetSchoolId = user.schoolId;
    if (isCentralUser(user)) {
      if (!data.schoolId) {
        throw new ApiError(400, 'SCHOOL_REQUIRED', 'Central officers must specify a schoolId');
      }
      targetSchoolId = data.schoolId;

      // Verify the target school exists
      const schoolExists = await prismaBase.school.findUnique({
        where: { id: targetSchoolId }
      });
      if (!schoolExists) {
        throw new ApiError(404, 'NOT_FOUND', 'Specified school not found');
      }
    }

    const cycle = await withClient(user, async (db) => {
      return db.admissionCycle.create({
        data: {
          title: data.title,
          academicYear: data.academicYear,
          startDate: data.startDate,
          endDate: data.endDate,
          active: data.active,
          schoolId: targetSchoolId,
        },
      });
    });

    return successResponse({ cycle }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

