import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// Fail fast: the JWT signing secret MUST come from the environment. There is no
// fallback so a missing secret is a hard startup/config error, never a silent one.
// The secret is referenced directly (not via a wrapper) so Next can inline the
// value into both the Node server AND the Edge middleware bundles consistently.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it before starting the server.');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

const COOKIE_NAME = 'auth_token';

export interface AuthPayload {
  userId: string;
  role: string;
  schoolId: string;
  /**
   * Fine-grained sub-role (e.g. HOD, CLASS_COORDINATOR, PROGRAM_COORDINATOR).
   * Carried in the token so role+position authorization can be decided without a
   * second database read. Null when the user has no explicit position.
   */
  position?: string | null;
  /** Assigned dynamic custom role id (if any). Used to resolve effective permissions. */
  customRoleId?: string | null;
  /** Account active flag; false blocks login (deactivated officers). */
  active?: boolean;
}

// Canonical user shape returned by both /api/auth/login and /api/auth/me.
export interface AuthUserShape {
  id: string;
  name: string;
  email: string;
  role: string;
  position?: string | null;
  schoolId: string;
  customRoleId?: string | null;
  active: boolean;
  /** Effective resolved permission array (computed server-side; see perms.ts). */
  permissions: string[];
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as AuthPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearAuthCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getAuthFromRequest(request: Request | NextRequest): Promise<AuthPayload | null> {
  let token: string | undefined;

  if (request instanceof NextRequest) {
    token = request.cookies.get(COOKIE_NAME)?.value;
  } else {
    // Fallback for standard Request if needed (e.g. in some edge cases)
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      token = match ? match[1] : undefined;
    }
  }

  if (!token) return null;
  return verifyToken(token);
}
