import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJwtEdge } from '@/lib/jwt-edge';

// Public (unauthenticated) API routes.
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  // Public admissions endpoints (active cycles for the public apply page).
  '/api/admissions/public/cycles',
  // Public certificate verification (third parties verify authenticity without auth).
  '/api/certificates/verify',
];

// Path (exact) that permits unauthenticated PUBLIC POST only (applicant submission).
// All other methods on this path (and every other /api/* path) require auth.
const PUBLIC_POST_PATH = '/api/admissions/applications';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Public applicant submission: unauthenticated POST on the exact path is allowed.
  if (pathname === PUBLIC_POST_PATH && request.method === 'POST') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    const token =
      request.cookies.get('auth_token')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication token required' } },
        { status: 401 }
      );
    }

    // Best-effort first line of defence: reject forged/tampered/expired tokens at
    // the edge when possible, so they never reach the route handlers. `withAuth`
    // re-verifies on the Node side and is the authoritative gate; if the Edge
    // crypto runtime cannot execute (e.g. SubtleCrypto.importKey unavailable in
    // the current Edge build), we fall through and let Node-side verification
    // decide, rather than failing every authenticated request with a 500.
    try {
      const payload = await verifyJwtEdge(token);
      if (!payload) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired authentication token' } },
          { status: 401 }
        );
      }
    } catch (err) {
      console.warn(
        '[middleware] Edge JWT verification unavailable; deferring to Node auth:',
        err
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
