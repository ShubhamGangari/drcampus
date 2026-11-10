import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateFeeStructureSchema } from '@/lib/fees-schemas';
import { assertProgramBelongsToSchool, computeComponentsTotal } from '@/lib/fee-core';
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
// PUT /api/fees/structures/[id] — update a fee structure (FINANCE_OFFICER).
// Body (partial): programId? / academicYear? / semester? / components? /
// totalAmount? — when components is provided totalAmount is recomputed from it.
// 200 { id, programId, academicYear, semester, components, totalAmount }
//  404 structure missing | 400 validation / program-tenant mismatch
// ---------------------------------------------------------------------------
export const PUT = withAuth(async (request, { params, user }) => {
  try {
    if (!guardRole(user.role, FINANCE_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer access required');
    }

    const { id } = params;
    const body = await validateBody(request, updateFeeStructureSchema);

    return await withClient(user, async (db) => {
      // Load the structure. For a school-scoped officer the extended client already
      // scopes by schoolId; for a central officer the lookup is global.
      const existing = await db.feeStructure.findUnique({
        where: { id },
        select: {
          id: true,
          schoolId: true,
          programId: true,
          academicYear: true,
          semester: true,
          componentsJson: true,
          totalAmount: true,
        },
      });
      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Fee structure not found');
      }

      // Resolve the tenant this structure belongs to. A non-central officer must be
      // scoped to the same school as the structure (the extended client guarantees
      // this, but we assert defensively so a mismatch is a clean 404).
      const tenant = isCentralUser(user) ? existing.schoolId : user.schoolId;
      if (!isCentralUser(user) && existing.schoolId !== tenant) {
        throw new ApiError(404, 'NOT_FOUND', 'Fee structure not found');
      }

      const data: Record<string, unknown> = {};
      if (body.programId !== undefined) {
        await assertProgramBelongsToSchool(db, body.programId, tenant);
        data.programId = body.programId;
      }
      if (body.academicYear !== undefined) data.academicYear = body.academicYear;
      if (body.semester !== undefined) data.semester = body.semester;

      // totalAmount is NEVER taken from the client. It is always recomputed from
      // the component set: the newly-supplied ones when `components` is provided,
      // otherwise the structure's existing stored components. This keeps the
      // persisted total in exact agreement with the component sum.
      const nextComponents =
        body.components !== undefined ? body.components : parseComponents(existing.componentsJson);
      data.totalAmount = computeComponentsTotal(nextComponents);
      if (body.components !== undefined) {
        data.componentsJson = JSON.stringify(body.components);
      }

      const updated = await db.feeStructure.update({
        where: { id },
        data,
        select: {
          id: true,
          programId: true,
          academicYear: true,
          semester: true,
          componentsJson: true,
          totalAmount: true,
        },
      });

      return successResponse({
        id: updated.id,
        programId: updated.programId,
        academicYear: updated.academicYear,
        semester: updated.semester,
        components: parseComponents(updated.componentsJson),
        totalAmount: updated.totalAmount,
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
});
