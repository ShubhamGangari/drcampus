import { validateBody, errorResponse, successResponse, ApiError } from '@/lib/api';
import { loginSchema } from '@/lib/validators';
import { createToken, setAuthCookie, verifyPassword } from '@/lib/auth';
import { prismaBase } from '@/lib/prisma';
import { resolveUserEffectivePermissions } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, password } = await validateBody(request, loginSchema);

    // Login identifies the caller BEFORE any tenant context exists, so it uses the
    // unextended client to look the user up by email (email is globally unique).
    const user = await prismaBase.user.findUnique({
      where: { email },
    });

    if (!user || !(await verifyPassword(password, user.password))) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.active === false) {
      throw new ApiError(401, 'ACCOUNT_DISABLED', 'This account has been disabled');
    }

    const permissions = await resolveUserEffectivePermissions(user);

    const token = createToken({
      userId: user.id,
      role: user.role,
      schoolId: user.schoolId,
      position: user.position,
      customRoleId: user.customRoleId,
      active: user.active,
    });

    setAuthCookie(token);

    return successResponse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position,
        schoolId: user.schoolId,
        customRoleId: user.customRoleId,
        active: user.active,
        permissions,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
