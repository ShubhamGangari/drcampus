import { withAuth, successResponse, ApiError } from '@/lib/api';
import { prismaBase } from '@/lib/prisma';
import { resolveUserEffectivePermissions } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, { user }) => {
  const dbUser = await prismaBase.user.findUnique({
    where: { id: user.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      position: true,
      schoolId: true,
      customRoleId: true,
      active: true,
    },
  });

  if (!dbUser) {
    throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
  }

  const permissions = await resolveUserEffectivePermissions(dbUser);

  return successResponse({
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      position: dbUser.position,
      schoolId: dbUser.schoolId,
      customRoleId: dbUser.customRoleId,
      active: dbUser.active,
      permissions,
    },
  });
});
