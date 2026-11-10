// ==============================================================================
// Zod schemas for the Fees Management API contract (Module 3).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const feeComponentSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().min(0),
});

export const createFeeStructureSchema = z.object({
  programId: z.string().min(1),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'academicYear must be YYYY-YYYY'),
  semester: z.number().int().min(1).max(12),
  components: z.array(feeComponentSchema).min(1, 'components must not be empty'),
  // Accepted for contract compatibility but ALWAYS recomputed server-side from
  // the component sum; never trusted from the client.
  totalAmount: z.number().min(0).optional(),
  schoolId: z.string().optional(),
});

export const updateFeeStructureSchema = z.object({
  programId: z.string().min(1).optional(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'academicYear must be YYYY-YYYY').optional(),
  semester: z.number().int().min(1).max(12).optional(),
  components: z.array(feeComponentSchema).min(1, 'components must not be empty').optional(),
  totalAmount: z.number().min(0).optional(),
}).refine((v) => Object.keys(v).length > 0, {
  message: 'No fields to update',
});

export const generateInvoiceSchema = z.object({
  studentId: z.string().min(1),
  structureId: z.string().min(1),
  dueDate: z.string().transform((val, ctx) => {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'dueDate must be a valid date' });
      return z.NEVER;
    }
    return d;
  }),
  schoolId: z.string().optional(),
});

export const PAYMENT_MODES = [
  'UPI',
  'NET_BANKING',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'NEFT_RTGS',
  'CASH',
] as const;

export const createPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().min(0),
  mode: z.enum(PAYMENT_MODES),
  transactionRef: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
  schoolId: z.string().optional(),
});
