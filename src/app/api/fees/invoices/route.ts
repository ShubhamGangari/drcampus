import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { findSelfStudent } from '@/lib/fee-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const FINANCE_ROLE = 'FINANCE_OFFICER';
const STUDENT_ROLE = 'STUDENT';

// ---------------------------------------------------------------------------
// GET /api/fees/invoices?studentId&status — list invoices.
// FINANCE_OFFICER (all, optional filters) | STUDENT (own only).
// 200 [{ id, invoiceNo, studentId, programId, amount, paidAmount, dueDate,
//        status, paid }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, FINANCE_ROLE, STUDENT_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer or student access required');
    }

    const url = new URL(request.url);
    const queryStudentId = url.searchParams.get('studentId') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;

    return await withClient(user, async (db) => {
      const where: Record<string, unknown> = {};

      if (user.role === STUDENT_ROLE) {
        const self = await findSelfStudent(db, user);
        if (!self) return successResponse([]);
        where.studentId = self.id;
      } else if (queryStudentId) {
        where.studentId = queryStudentId;
      }
      if (status) where.status = status;

      const invoices = await db.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNo: true,
          studentId: true,
          amount: true,
          paidAmount: true,
          dueDate: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Resolve programId per student for the response payload.
      const studentIds = Array.from(new Set(invoices.map((i) => i.studentId)));
      let programMap: Record<string, string> = {};
      if (studentIds.length) {
        const students = await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, programId: true },
        });
        programMap = Object.fromEntries(students.map((s) => [s.id, s.programId]));
      }

      const data = invoices.map((i) => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        studentId: i.studentId,
        programId: programMap[i.studentId] ?? null,
        amount: i.amount,
        paidAmount: i.paidAmount,
        dueDate: i.dueDate.toISOString(),
        status: i.status,
        paid: i.status === 'PAID',
      }));

      return successResponse(data);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
