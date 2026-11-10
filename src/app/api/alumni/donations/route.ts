import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createDonationSchema } from '@/lib/alumni-schemas';
import {
  resolveCreateTenant,
  findSelfStudent,
  tenantFilter,
  computeDonationTotals,
  assertValidDonationAmount,
  isDonationMode,
} from '@/lib/alumni-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/alumni/donations?schoolId= — donation report.
// REGISTRAR_ADMIN | DEAN.
// 200 { donations: [{ id, alumniId, alumniName, amount, mode, createdAt }],
//        totals: { count, sum } }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'REGISTRAR_ADMIN', 'DEAN')) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar or dean access required');
    }

    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    const result = await withClient(user, async (db) => {
      const donations = await db.alumniDonation.findMany({
        where: tenantFilter(isCentralUser(user), schoolId),
        orderBy: { createdAt: 'desc' },
      });

      const totals = computeDonationTotals(donations);

      const alumniIds: string[] = Array.from(
        new Set(donations.map((d) => d.alumniId))
      );
      const alumni = alumniIds.length
        ? await db.alumni.findMany({
          where: { id: { in: alumniIds } },
          select: { id: true, studentId: true },
        })
        : [];

      const studentIds: string[] = alumni.map((a) => a.studentId);
      const students = studentIds.length
        ? await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, firstName: true, lastName: true },
        })
        : [];
      const nameById = new Map<string, string>(
        students.map((s) => [s.id, `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()])
      );
      const alumniNameById = new Map<string, string>(
        alumni.map((a) => [a.id, nameById.get(a.studentId) ?? ''])
      );

      const list = donations.map((d) => ({
        id: d.id,
        alumniId: d.alumniId,
        alumniName: alumniNameById.get(d.alumniId) ?? '',
        amount: d.amount,
        mode: d.mode,
        createdAt: d.createdAt,
      }));

      return { donations: list, totals };
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/alumni/donations — alumni student records a donation.
// STUDENT (own alumni) only.
// Body { schoolId?, amount, mode } -> 201 { donationId }.
// 400 amount<=0 or invalid mode | 403 not alumni / not student.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Alumni student access required');
    }

    const body = await validateBody(request, createDonationSchema);
    const amount = assertValidDonationAmount(body.amount);
    if (!isDonationMode(body.mode)) {
      throw new ApiError(400, 'INVALID_MODE', 'Invalid donation mode');
    }
    const schoolId = resolveCreateTenant(user, body.schoolId);

    const donationId = await withClient(user, async (db) => {
      const self = await findSelfStudent(db, user);
      if (!self) {
        throw new ApiError(403, 'FORBIDDEN', 'No student account linked to this user');
      }
      const alumni = await db.alumni.findFirst({
        where: { studentId: self.id },
        select: { id: true },
      });
      if (!alumni) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not an alumni member');
      }

      const created = await db.alumniDonation.create({
        data: { schoolId, alumniId: alumni.id, amount, mode: body.mode },
        select: { id: true },
      });
      return created.id;
    });

    return successResponse({ donationId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
