import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createFeeStructureSchema } from '@/lib/fees-schemas';
import {
  resolveCreateTenant,
  assertProgramBelongsToSchool,
} from '@/lib/fee-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const FINANCE_ROLE = 'FINANCE_OFFICER';

function parseComponents(json: string): Array<{ name: string; amount: number }> {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// POST /api/fees/structures — create a fee structure (FINANCE_OFFICER).
// 201 { structureId } | 400 validation/program-tenant | 404 program missing
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, FINANCE_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer access required');
    }

    const body = await validateBody(request, createFeeStructureSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    return await withClient(user, async (db) => {
      // Program must exist and belong to the resolved tenant.
      await assertProgramBelongsToSchool(db, body.programId, tenant);

      // Recompute totalAmount as the exact sum of components (float-safe to cent).
      const totalAmount =
        Math.round(body.components.reduce((sum, c) => sum + c.amount, 0) * 100) / 100;
      if (totalAmount < 0) {
        throw new ApiError(400, 'INVALID_TOTAL', 'totalAmount cannot be negative');
      }

      const structure = await db.feeStructure.create({
        data: {
          schoolId: tenant,
          programId: body.programId,
          academicYear: body.academicYear,
          semester: body.semester,
          componentsJson: JSON.stringify(body.components),
          totalAmount,
        },
        select: { id: true },
      });

      return successResponse({ structureId: structure.id }, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/fees/structures?programId&academicYear — list (FINANCE_OFFICER).
// 200 [{ id, programId, academicYear, semester, components, totalAmount }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, FINANCE_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer access required');
    }

    const url = new URL(request.url);
    const programId = url.searchParams.get('programId') ?? undefined;
    const academicYear = url.searchParams.get('academicYear') ?? undefined;

    return await withClient(user, async (db) => {
      const where: Record<string, unknown> = {};
      if (programId) where.programId = programId;
      if (academicYear) where.academicYear = academicYear;

      const structures = await db.feeStructure.findMany({
        where,
        select: {
          id: true,
          programId: true,
          academicYear: true,
          semester: true,
          componentsJson: true,
          totalAmount: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = structures.map((s) => ({
        id: s.id,
        programId: s.programId,
        academicYear: s.academicYear,
        semester: s.semester,
        components: parseComponents(s.componentsJson),
        totalAmount: s.totalAmount,
      }));

      return successResponse(data);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
