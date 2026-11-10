import { Prisma } from '@prisma/client';
import { withClient, type Db } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createPaymentSchema } from '@/lib/fees-schemas';
import {
  resolveCreateTenant,
  findSelfStudent,
  buildReceiptNo,
  getNextSequence,
  computeInvoicePaid,
  INVOICE_TERMINAL_STATUSES,
} from '@/lib/fee-core';
import { writeAuditLog } from '@/lib/audit-writer';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

const FINANCE_ROLE = 'FINANCE_OFFICER';
const MAX_SEQ_ATTEMPTS = 25;

// ---------------------------------------------------------------------------
// POST /api/fees/payments — record a payment (FINANCE_OFFICER / STUDENT-self).
// 201 { paymentId, receiptNo }
//   400 INVALID_AMOUNT (amount <= 0) | AMOUNT_EXCEEDS_INVOICE
//   404 invoice missing | 403 student cannot pay another student's invoice
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, FINANCE_ROLE, 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer or student access required');
    }

    const body = await validateBody(request, createPaymentSchema);
    if (body.amount <= 0) {
      throw new ApiError(400, 'INVALID_AMOUNT', 'Payment amount must be greater than zero');
    }

    return await withClient(user, async (db) => {
      // Tenant resolution: students are always school-scoped (their own school);
      // finance officers follow the central/per-school rule.
      let tenant: string;
      let selfStudent: { id: string } | null = null;

      if (user.role === 'STUDENT') {
        selfStudent = await findSelfStudent(db, user);
        if (!selfStudent) {
          throw new ApiError(403, 'FORBIDDEN', 'No student record linked to this account');
        }
        tenant = user.schoolId;
      } else {
        tenant = resolveCreateTenant(user, body.schoolId);
      }

      // Atomic read-check-create-update for one payment. Central ('ALL') callers
      // use the unscoped base client; per-school callers use the scoped extended
      // client. Both expose $transaction, so we funnel through `db`.
      const selfId: string | null = selfStudent ? selfStudent.id : null;
      return await db.$transaction(async (tx) => {
        // Idempotency: if this key already produced a payment, return it as-is.
        if (body.idempotencyKey) {
          const existingByKey = await tx.payment.findUnique({
            where: { idempotencyKey: body.idempotencyKey },
            select: { id: true, receiptNo: true },
          });
          if (existingByKey) {
            return successResponse(
              { paymentId: existingByKey.id, receiptNo: existingByKey.receiptNo },
              200
            );
          }
        }

        const invoice = await tx.invoice.findUnique({
          where: { id: body.invoiceId },
          select: { id: true, studentId: true, schoolId: true, amount: true, status: true },
        });
        if (!invoice) {
          throw new ApiError(404, 'NOT_FOUND', 'Invoice not found');
        }
        // Terminal invoices (PAID/CANCELED/VOID) can never accept further payments.
        if (
          INVOICE_TERMINAL_STATUSES.includes(
            invoice.status as (typeof INVOICE_TERMINAL_STATUSES)[number]
          )
        ) {
          throw new ApiError(409, 'INVOICE_NOT_ACTIVE', 'Invoice is not active for payment');
        }
        // The resolved tenant must match the invoice's school. For school-scoped
        // users this is already guaranteed by the client's auto-scope; for central
        // ('ALL') officers it prevents cross-school mislabelling.
        if (invoice.schoolId !== tenant) {
          throw new ApiError(400, 'SCHOOL_MISMATCH', 'Invoice does not belong to this school');
        }
        if (user.role === 'STUDENT' && invoice.studentId !== selfId) {
          throw new ApiError(403, 'FORBIDDEN', 'Students can only pay their own invoices');
        }

        const payments = await tx.payment.findMany({
          where: { invoiceId: invoice.id },
          select: { amount: true },
        });
        const paidSoFar = payments.reduce(
          (sum: number, p: { amount: number }) => sum + p.amount,
          0
        );

        if (paidSoFar + body.amount > invoice.amount) {
          throw new ApiError(
            400,
            'AMOUNT_EXCEEDS_INVOICE',
            'Payment total cannot exceed the invoice amount'
          );
        }

        const year = new Date().getFullYear();
        const prefix = `RCPT-${year}-`;

        const seq0 = await getNextSequence(tx as unknown as Db, 'payment', 'receiptNo', prefix, tenant);
        let payment: { id: string; receiptNo: string } | null = null;
        for (let attempt = 0; attempt < MAX_SEQ_ATTEMPTS && !payment; attempt++) {
          const receiptNo = buildReceiptNo(seq0 + attempt, year);
          try {
            payment = await tx.payment.create({
              data: {
                schoolId: tenant,
                invoiceId: invoice.id,
                amount: body.amount,
                mode: body.mode,
                transactionRef: body.transactionRef ?? null,
                receiptNo,
                ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
              },
              select: { id: true, receiptNo: true },
            });
          } catch (err) {
            const e = err as { code?: string } | null;
            if (e?.code === 'P2002') {
              // Could be a receiptNo collision (retry with next candidate) OR an
              // idempotencyKey collision from a concurrent request with the same
              // key (return the existing record instead of duping).
              if (body.idempotencyKey) {
                const dup = await tx.payment.findUnique({
                  where: { idempotencyKey: body.idempotencyKey },
                  select: { id: true, receiptNo: true },
                });
                if (dup) {
                  return successResponse(
                    { paymentId: dup.id, receiptNo: dup.receiptNo },
                    200
                  );
                }
              }
              continue;
            }
            throw err;
          }
        }

        if (!payment) {
          throw new ApiError(500, 'RECEIPT_SEQ_EXHAUSTED', 'Could not allocate a unique receipt number');
        }

        // Recompute the invoice from the full payment set.
        const newPaid = computeInvoicePaid(invoice.amount, [...payments, { amount: body.amount }]);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paidAmount: newPaid.paidAmount, status: newPaid.status },
        });

        await writeAuditLog(tx, {
          schoolId: tenant,
          actorId: user.userId,
          action: 'PAYMENT_RECORDED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          summary: `Recorded payment ${payment.receiptNo} for invoice ${invoice.id}`,
        });

        return successResponse({ paymentId: payment.id, receiptNo: payment.receiptNo }, 201);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/fees/payments?invoiceId — list payments.
// FINANCE_OFFICER (all, optional invoiceId filter) | STUDENT (own only).
// 200 [{ id, invoiceId, invoiceNo, studentId, amount, mode, transactionRef?,
//        receiptNo, createdAt }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, FINANCE_ROLE, 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Finance officer or student access required');
    }

    const url = new URL(request.url);
    const queryInvoiceId = url.searchParams.get('invoiceId') ?? undefined;

    return await withClient(user, async (db) => {
      const where: Record<string, unknown> = {};
      if (queryInvoiceId) where.invoiceId = queryInvoiceId;

      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (!self) return successResponse([]);
        const invoices = await db.invoice.findMany({
          where: { studentId: self.id },
          select: { id: true },
        });
        const ownInvoiceIds = Array.from(new Set(invoices.map((i) => i.id)));
        if (ownInvoiceIds.length === 0) return successResponse([]);
        where.invoiceId = { in: ownInvoiceIds };
      }

      const payments = await db.payment.findMany({
        where,
        select: {
          id: true,
          invoiceId: true,
          amount: true,
          mode: true,
          transactionRef: true,
          receiptNo: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Join invoiceNo + studentId (Payment has no FK relation to Invoice in schema).
      const invoiceIds = Array.from(new Set(payments.map((p) => p.invoiceId)));
      let invoiceMap: Record<string, { invoiceNo: string; studentId: string }> = {};
      if (invoiceIds.length) {
        const invoices = await db.invoice.findMany({
          where: { id: { in: invoiceIds } },
          select: { id: true, invoiceNo: true, studentId: true },
        });
        invoiceMap = Object.fromEntries(invoices.map((iv) => [iv.id, iv]));
      }

      const data = payments.map((p) => ({
        id: p.id,
        invoiceId: p.invoiceId,
        invoiceNo: invoiceMap[p.invoiceId]?.invoiceNo ?? null,
        studentId: invoiceMap[p.invoiceId]?.studentId ?? null,
        amount: p.amount,
        mode: p.mode,
        transactionRef: p.transactionRef ?? null,
        receiptNo: p.receiptNo,
        createdAt: p.createdAt.toISOString(),
      }));

      return successResponse(data);
    });
  } catch (error) {
    return errorResponse(error);
  }
});
