import { NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { getAuthFromRequest, AuthPayload } from './auth';
import { schoolIdStorage } from './prisma';
import { ApiError } from './errors';

export { ApiError } from './errors';

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.issues,
        },
      },
      { status: 400 }
    );
  }

  console.error('[API Error]:', error);
  return NextResponse.json(
    { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 }
  );
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function validateBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) throw error;
    throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON body');
  }
}

type AuthenticatedHandler = (
  request: Request,
  context: { user: AuthPayload; params: Record<string, string> }
) => Promise<Response>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (request: Request, { params }: { params: Record<string, string> }) => {
    try {
      const user = await getAuthFromRequest(request);
      if (!user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      return await schoolIdStorage.run(user.schoolId, async () => {
        return await handler(request, { user, params });
      });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
