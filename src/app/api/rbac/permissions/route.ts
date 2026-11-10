import { withAuth, successResponse } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/rbac-admin';
import { PERMISSION_CATALOG } from '@/lib/perms';

// GET /api/rbac/permissions — grouped permission catalog for the Admin Console UI.
// Spec §4.1. SUPER_ADMIN only.
export const GET = withAuth(async (_request, { user }) => {
    requireSuperAdmin(user);
    return successResponse({ areas: PERMISSION_CATALOG });
});
