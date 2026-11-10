import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';

export const GET = withAuth(async (request, { user, params }) => {
  try {
    const { id } = params;
    const application = await withClient(user, (db) =>
      db.application.findUnique({
        where: { id },
        include: {
          cycle: true,
        },
      })
    );

    if (!application) {
      throw new ApiError(404, 'NOT_FOUND', 'Application not found');
    }

    return successResponse({ application });
  } catch (error) {
    return errorResponse(error);
  }
});

