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
// GET /api/hostel/mess/bills?schoolId=&studentId= — list mess bills.
// FINANCE_OFFICER / REGISTRAR_ADMIN / STUDENT (student sees own only).
// 200 [{ id, studentId, studentName, month, amount, paid }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'FINANCE_OFFICER', 'REGISTRAR_ADMIN', 'STUDENT', 'DEAN')) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to view mess bills');
    }

    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;
    const queryStudentId = url.searchParams.get('studentId') ?? undefined;

    const bills = await withClient(user, async (db) => {
      const where: Record<string, unknown> = tenantFilter(isCentralUser(user), schoolId);

      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) return [];
        where.studentId = self.id;
      } else if (queryStudentId) {
        where.studentId = queryStudentId;
      }

      const rows = await db.messBill.findMany({
        where,
        orderBy: [{ month: 'desc' }],
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

      return rows.map((b) => ({
        id: b.id,
        studentId: b.studentId,
        studentName: studentName(studentMap.get(b.studentId)),
        month: b.month,
        amount: b.amount,
        paid: b.paid,
      }));
    });

    return successResponse(bills);
  } catch (error) {
    return errorResponse(error);
  }
});
