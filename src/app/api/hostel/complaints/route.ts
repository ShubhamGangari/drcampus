import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createComplaintSchema } from '@/lib/hostel-schemas';
import {
  resolveCreateTenant,
  findSelfStudent,
  tenantFilter,
} from '@/lib/hostel-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

function studentName(s: { firstName: string; lastName: string } | null | undefined): string {
  if (!s) return '';
  return `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
}

// ---------------------------------------------------------------------------
// GET /api/hostel/complaints?schoolId= — list complaints.
// DEAN / REGISTRAR_ADMIN / STUDENT (student sees own only).
// 200 [{ id, studentId, studentName, type, description, status, createdAt }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'DEAN', 'REGISTRAR_ADMIN', 'STUDENT', 'FINANCE_OFFICER')) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to view complaints');
    }

    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    const complaints = await withClient(user, async (db) => {
      const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);

      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) return [];
        where.studentId = self.id;
      }

      const rows = await db.hostelComplaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      const studentIds: string[] = rows.reduce((acc: string[], r) => {
        if (r.studentId && !acc.includes(r.studentId)) acc.push(r.studentId);
        return acc;
      }, []);
      const students: Array<{ id: string; firstName: string; lastName: string }> =
        studentIds.length
          ? await db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true },
          })
          : [];
      const studentMap = new Map<string, { id: string; firstName: string; lastName: string }>(
        students.map((s) => [s.id, s])
      );

      return rows.map((c) => ({
        id: c.id,
        studentId: c.studentId,
        studentName: studentName(studentMap.get(c.studentId)),
        type: c.type,
        description: c.description,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      }));
    });

    return successResponse(complaints);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/hostel/complaints — submit a complaint (STUDENT, self only).
// Student is derived from the JWT session, never from the body.
// 201 { complaintId } | 400 missing type/description | 403 not a student
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Only students may submit complaints');
    }

    const body = await validateBody(request, createComplaintSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    const complaintId = await withClient(user, async (db) => {
      const self = await findSelfStudent(db, user);
      if (!self) {
        throw new ApiError(403, 'FORBIDDEN', 'No student record is linked to this account');
      }

      const complaint = await db.hostelComplaint.create({
        data: {
          studentId: self.id,
          type: body.type,
          description: body.description,
          schoolId: tenant,
        },
      });
      return complaint.id as string;
    });

    return successResponse({ complaintId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
