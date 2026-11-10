import { prismaBase, schoolIdStorage } from '@/lib/prisma';
import { successResponse, errorResponse, ApiError } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Public (unauthenticated) — active admission cycles for the public apply page.
// Returns ONLY public fields ({ id, title, academicYear }), no counts, and is
// scoped to the `schoolId` query param to avoid cross-tenant leakage.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId');

    if (!schoolId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'schoolId query param is required');
    }

    const school = await prismaBase.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      throw new ApiError(404, 'NOT_FOUND', 'School not found');
    }

    const cycles = await schoolIdStorage.run(schoolId, async () => {
      return prisma.admissionCycle.findMany({
        where: { active: true },
        select: { id: true, title: true, academicYear: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    return successResponse({ cycles });
  } catch (error) {
    return errorResponse(error);
  }
}
