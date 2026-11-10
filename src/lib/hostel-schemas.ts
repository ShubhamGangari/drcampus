// ==============================================================================
// Zod schemas for the Hostel Management API contract (Module 8).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const COMPLAINT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;

export const createRoomSchema = z.object({
  schoolId: z.string().optional(),
  roomNo: z.string().min(1, 'roomNo is required').max(50),
  type: z.string().min(1, 'type is required').max(100),
  capacity: z.number().int().min(1, 'capacity must be at least 1').max(100000),
});

export const allocateSchema = z.object({
  schoolId: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required'),
  roomId: z.string().min(1, 'roomId is required'),
});

export const vacateSchema = z.object({
  schoolId: z.string().optional(),
  allocationId: z.string().min(1, 'allocationId is required'),
});

export const createMessBillSchema = z.object({
  schoolId: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required'),
  month: z.string().regex(MONTH_REGEX, 'month must be YYYY-MM'),
  amount: z.number().refine((v) => v > 0, 'amount must be greater than 0'),
});

export const markMessBillPaidSchema = z.object({
  billId: z.string().min(1, 'billId is required'),
});

export const createComplaintSchema = z.object({
  schoolId: z.string().optional(),
  type: z.string().min(1, 'type is required').max(100),
  description: z.string().min(1, 'description is required').max(2000),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES, {
    error: 'status must be OPEN, IN_PROGRESS or RESOLVED',
  }),
});
