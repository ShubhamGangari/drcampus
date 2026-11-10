import { withClient, type Db } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { generateInvoiceSchema } from '@/lib/fees-schemas';
import {
  resolveCreateTenant,
  assertStudentBelongsToSchool,
  buildInvoiceNo,
  getNextSequence,
  isActiveInvoiceStatus,
  isDueDateInPast,
  INVOICE_ACTIVE_STATUSES,
} from '@/lib/fee-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const FINANCE_ROLE = 'FINANCE_OFFICER';
const MAX_SEQ_ATTEMPTS = 25;

// ---------------------------------------------------------------------------
// POST /api/fees/invoices/generate — create an invoice (FINANCE_OFFICER).
// 201 { invoiceId, invoiceNo, amount }
//   400 ALREADY_INVOICED (active invoice exists for student+structure)
//   404 student/structure missing | 400 SCHOOL_MISMATCH
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, FINANCE_ROLE)) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer access required');
    }

    const body = await validateBody(request, generateInvoiceSchema);
    // Reject backdated due dates (before the start of today).
    if (isDueDateInPast(body.dueDate)) {
      throw new ApiError(400, 'DUE_DATE_IN_PAST', 'dueDate cannot be in the past');
    }
    const tenant = resolveCreateTenant(user, body.schoolId);

    return await withClient(user, async (db) => {
      const student = await assertStudentBelongsToSchool(db, body.studentId, tenant);

      const structure = await db.feeStructure.findUnique({
        where: { id: body.structureId },
        select: { id: true, schoolId: true, totalAmount: true },
      });
      if (!structure) {
        throw new ApiError(404, 'NOT_FOUND', 'Fee structure not found');
      }
      if (structure.schoolId !== tenant) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Fee structure does not belong to this school');
      }

      const year = new Date().getFullYear();
      const prefix = `INV-${year}-`;

      // Serialize the already-invoiced check + insert in one transaction so two
      // concurrent generations cannot both pass the check and create duplicates.
      // Safe on SQLite's single-writer model.
      return await db.$transaction(async (tx) => {
        // Prevent duplicate ACTIVE invoice for the same student + structure. A
        // terminal invoice (PAID / CANCELED / VOID) does not block a new one.
        const existing = await tx.invoice.findFirst({
          where: { schoolId: tenant, studentId: student.id, structureId: structure.id },
          select: { status: true },
        });
        if (existing && isActiveInvoiceStatus(existing.status)) {
          throw new ApiError(
            400,
            'ALREADY_INVOICED',
            'An active invoice already exists for this student and fee structure'
          );
        }

        // Generate a unique invoice number. The base sequence is derived per school
        // but invoiceNo is GLOBALLY unique, so a candidate can collide with a number
        // issued by another school (or a concurrent insert). On collision we walk the
        // candidate upward (seq + attempt) until we find a free number.
        const seq0 = await getNextSequence(tx as unknown as Db, 'invoice', 'invoiceNo', prefix, tenant);
        let invoice: { id: string; invoiceNo: string; amount: number } | null = null;
        for (let attempt = 0; attempt < MAX_SEQ_ATTEMPTS && !invoice; attempt++) {
          const invoiceNo = buildInvoiceNo(seq0 + attempt, year);
          try {
            invoice = await tx.invoice.create({
              data: {
                schoolId: tenant,
                studentId: student.id,
                structureId: structure.id,
                invoiceNo,
                amount: structure.totalAmount,
                dueDate: body.dueDate,
                status: 'UNPAID',
                paidAmount: 0,
              },
              select: { id: true, invoiceNo: true, amount: true },
            });
          } catch (err) {
            const e = err as { code?: string } | null;
            if (e?.code === 'P2002') continue; // invoiceNo collision -> try next candidate
            throw err;
          }
        }

        if (!invoice) {
          throw new ApiError(500, 'INVOICE_SEQ_EXHAUSTED', 'Could not allocate a unique invoice number');
        }

        // Re-verify exactly one active invoice exists for (student, structure). If
        // a concurrent create produced two, roll back this entire transaction.
        const activeCount = await tx.invoice.count({
          where: {
            schoolId: tenant,
            studentId: student.id,
            structureId: structure.id,
            status: { in: Array.from(INVOICE_ACTIVE_STATUSES) },
          },
        });
        if (activeCount !== 1) {
          throw new ApiError(
            400,
            'ALREADY_INVOICED',
            'An active invoice already exists for this student and fee structure'
          );
        }

        return successResponse(
          { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo, amount: invoice.amount },
          201
        );
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
});
