import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { INVOICE_ACTIVE_STATUSES } from '@/lib/fee-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const FINANCE_ROLE = 'FINANCE_OFFICER';

// ---------------------------------------------------------------------------
// GET /api/fees/dues?programId — dues summary (FINANCE_OFFICER).
// 200 [{ studentId, name, rollNo, totalDue, lastPaymentDate? }]
// Only students with unpaid/partially-paid invoices appear; totalDue = amount - paid.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, FINANCE_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer access required');
    }

    const url = new URL(request.url);
    const programId = url.searchParams.get('programId') ?? undefined;

    return await withClient(user, async (db) => {
      // Optional program filter: restrict to students enrolled in that program.
      let programStudentIds: string[] | null = null;
      if (programId) {
        const progStudents = await db.student.findMany({
          where: { programId },
          select: { id: true },
        });
        programStudentIds = progStudents.map((s) => s.id);
        if (!programStudentIds || programStudentIds.length === 0) return successResponse([]);
      }

      const invoiceWhere: Record<string, unknown> = {
        status: { in: [...INVOICE_ACTIVE_STATUSES] },
      };
      if (programStudentIds) invoiceWhere.studentId = { in: programStudentIds };

      const invoices = await db.invoice.findMany({
        where: invoiceWhere,
        select: { id: true, studentId: true, amount: true, paidAmount: true },
      });

      if (invoices.length === 0) return successResponse([]);

      const invoiceIds = invoices.map((i) => i.id);
      const payments = await db.payment.findMany({
        where: { invoiceId: { in: invoiceIds } },
        select: { invoiceId: true, createdAt: true },
      });

      // last payment timestamp per invoice, then aggregate per student.
      const lastByInvoice: Record<string, Date> = {};
      for (const p of payments) {
        const cur = lastByInvoice[p.invoiceId];
        if (!cur || p.createdAt > cur) lastByInvoice[p.invoiceId] = p.createdAt;
      }

      const byStudent: Record<string, { totalDue: number; lastPaymentDate?: Date }> = {};
      for (const inv of invoices) {
        const due = Math.round((inv.amount - inv.paidAmount) * 100) / 100;
        if (due <= 0) continue;
        const entry = byStudent[inv.studentId] ?? { totalDue: 0 };
        entry.totalDue = Math.round((entry.totalDue + due) * 100) / 100;
        const lp = lastByInvoice[inv.id];
        if (lp && (!entry.lastPaymentDate || lp > entry.lastPaymentDate)) {
          entry.lastPaymentDate = lp;
        }
        byStudent[inv.studentId] = entry;
      }

      const studentIds = Object.keys(byStudent);
      if (studentIds.length === 0) return successResponse([]);

      const students = await db.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, rollNo: true },
      });
      const studentMap = Object.fromEntries(
        students.map((s) => [s.id, s])
      );

      const data = studentIds.map((sid) => {
        const st = studentMap[sid];
        const d = byStudent[sid];
        return {
          studentId: sid,
          name: st ? `${st.firstName} ${st.lastName}` : 'Unknown',
          rollNo: st?.rollNo ?? null,
          totalDue: d.totalDue,
          ...(d.lastPaymentDate ? { lastPaymentDate: d.lastPaymentDate.toISOString() } : {}),
        };
      });

      return successResponse(data);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
