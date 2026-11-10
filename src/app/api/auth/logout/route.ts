import { clearAuthCookie } from '@/lib/auth';
import { successResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST() {
  clearAuthCookie();
  return successResponse({ message: 'Logged out successfully' });
}
