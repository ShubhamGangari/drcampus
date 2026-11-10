import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { findSelfStudent, tenantFilter } from '@/lib/hostel-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';


function studentName(s: { firstName: string; lastName: string } | null | undefined): string {
  if (!s) return '';
  return `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
}

// ---------------------------------------------------------------------------
// GET /api/hostel/allocations?schoolId=&studentId= — list allocations.
// DEAN / REGISTRAR_ADMIN / STUDENT (student sees own only).
// 200 [{ id, studentId, studentName, roomId, roomNo, allocationDate,
//        vacatedAt, status }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'DEAN', 'REGISTRAR_ADMIN', 'STUDENT', 'FINANCE_OFFICER')) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to view allocations');
    }

    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;
    const queryStudentId = url.searchParams.get('studentId') ?? undefined;

    const allocations = await withClient(user, async (db) => {
      const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);

      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) return [];
        where.studentId = self.id;
      } else if (queryStudentId) {
        where.studentId = queryStudentId;
      }

      const rows = await db.hostelAllocation.findMany({
        where,
        orderBy: { allocatedAt: 'desc' },
      });

      const studentIds: string[] = rows.reduce((acc: string[], r) => {
        if (r.studentId && !acc.includes(r.studentId)) acc.push(r.studentId);
        return acc;
      }, []);
      const roomIds: string[] = rows.reduce((acc: string[], r) => {
        if (r.roomId && !acc.includes(r.roomId)) acc.push(r.roomId);
        return acc;
      }, []);

      const students: Array<{ id: string; firstName: string; lastName: string }> =
        studentIds.length
          ? await db.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true },
          })
          : [];
      const rooms: Array<{ id: string; roomNo: string }> = roomIds.length
        ? await db.hostelRoom.findMany({
          where: { id: { in: roomIds } },
          select: { id: true, roomNo: true },
        })
        : [];

      const studentMap = new Map<string, { id: string; firstName: string; lastName: string }>(
        students.map((s) => [s.id, s])
      );
      const roomMap = new Map<string, { id: string; roomNo: string }>(
        rooms.map((r) => [r.id, r])
      );

      return rows.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        studentName: studentName(studentMap.get(a.studentId)),
        roomId: a.roomId,
        roomNo: roomMap.get(a.roomId)?.roomNo ?? '',
        allocationDate: a.allocatedAt.toISOString(),
        vacatedAt: a.vacatedAt ? a.vacatedAt.toISOString() : null,
        status: a.vacatedAt ? 'VACATED' : 'ACTIVE',
      }));
    });

    return successResponse(allocations);
  } catch (error) {
    return errorResponse(error);
  }
});
