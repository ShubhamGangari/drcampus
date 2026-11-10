import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createAlumniSchema } from '@/lib/alumni-schemas';
import {
  resolveCreateTenant,
  assertStudentBelongsToSchool,
  tenantFilter,
} from '@/lib/alumni-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/alumni?schoolId=&search= — alumni directory.
// REGISTRAR_ADMIN | DEAN.
// 200 [{ id, studentId, studentName, batch, email, phone, currentCompany, createdAt }]
// (search on name / company / email)
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'REGISTRAR_ADMIN', 'DEAN')) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar or dean access required');
    }

    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();

    const items = await withClient(user, async (db) => {
      const rows = await db.alumni.findMany({
        where: tenantFilter(isCentralUser(user), schoolId),
        orderBy: { createdAt: 'desc' },
      });

      const studentIds: string[] = rows.map((r) => r.studentId);
      const students = await db.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      const nameById = new Map<string, string>(
        students.map((s) => [s.id, `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()])
      );

      let items = rows.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: nameById.get(r.studentId) ?? '',
        batch: r.batch,
        email: r.email,
        phone: r.phone,
        currentCompany: r.currentCompany,
        createdAt: r.createdAt,
      }));

      if (search) {
        items = items.filter(
          (i) =>
            (i.studentName ?? '').toLowerCase().includes(search) ||
            (i.currentCompany ?? '').toLowerCase().includes(search) ||
            (i.email ?? '').toLowerCase().includes(search)
        );
      }

      return items;
    });

    return successResponse(items);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/alumni — create an alumni record for a graduating student.
// REGISTRAR_ADMIN only.
// Body { schoolId?, studentId, email, phone?, currentCompany?, batch? }.
// 201 { alumniId } | 400 missing studentId/email/invalid | 404 student not in
// tenant | 409 already alumni.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'REGISTRAR_ADMIN')) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar access required');
    }

    const body = await validateBody(request, createAlumniSchema);
    const schoolId = resolveCreateTenant(user, body.schoolId);

    const alumniId = await withClient(user, async (db) => {
      await assertStudentBelongsToSchool(db, body.studentId, schoolId);

      const existing = await db.alumni.findUnique({
        where: { studentId: body.studentId },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError(409, 'ALREADY_ALUMNI', 'Student already has an alumni record');
      }

      const created = await db.alumni.create({
        data: {
          schoolId,
          studentId: body.studentId,
          email: body.email,
          phone: body.phone ?? null,
          currentCompany: body.currentCompany ?? null,
          batch: body.batch ?? null,
        },
        select: { id: true },
      });
      return created.id;
    });

    return successResponse({ alumniId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
