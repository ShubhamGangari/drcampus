import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, ApiError } from '@/lib/api';
import { createPOSchema } from '@/lib/obe-schemas';
import { loadProgramTenant } from '@/lib/obe-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';


// ---------------------------------------------------------------------------
// GET /api/obe/programs/[programId]/pos — list POs of a program
// (FACULTY, DEAN, REGISTRAR_ADMIN). 200 [{ id, code, description }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, 'FACULTY', 'DEAN', 'REGISTRAR_ADMIN')) {
      throw new ApiError(403, 'FORBIDDEN', 'Faculty, dean or registrar access required');
    }

    const programId = params.programId as string;

    return await withClient(user, async (db) => {
      const { tenant } = await loadProgramTenant(db, user, programId);

      const pos = await db.programOutcome.findMany({
        where: { schoolId: tenant, programId },
        select: { id: true, code: true, description: true },
        orderBy: { code: 'asc' },
      });

      return successResponse(pos);
    });
  } catch (error) {
    throw error;
  }
});

// ---------------------------------------------------------------------------
// POST /api/obe/programs/[programId]/pos — create a program PO (FACULTY)
//   201 { poId } | 404 program missing | 409 duplicate code
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, 'FACULTY')) {
      throw new ApiError(403, 'FORBIDDEN', 'Faculty access required');
    }

    const body = await validateBody(request, createPOSchema);
    const programId = params.programId as string;

    return await withClient(user, async (db) => {
      const { tenant } = await loadProgramTenant(db, user, programId);

      const existing = await db.programOutcome.findFirst({
        where: { schoolId: tenant, programId, code: body.code },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError(409, 'DUPLICATE_PO', 'A PO with this code already exists for the program');
      }

      const po = await db.programOutcome.create({
        data: { schoolId: tenant, programId, code: body.code, description: body.description },
        select: { id: true },
      });

      return successResponse({ poId: po.id }, 201);
    });
  } catch (error) {
    throw error;
  }
});
