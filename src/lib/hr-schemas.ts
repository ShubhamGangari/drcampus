import { z } from 'zod';

export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const createEmployeeSchema = z.object({
  schoolId: z.string().optional(),
  employeeId: z.string().min(1, 'employeeId is required'),
  name: z.string().min(1, 'name is required'),
  designation: z.string().min(1, 'designation is required'),
  department: z.string().min(1, 'department is required'),
  userId: z.string().optional(),
});

export const createLeaveSchema = z.object({
  schoolId: z.string().optional(),
  fromDate: z.string().min(1, 'fromDate is required'),
  toDate: z.string().min(1, 'toDate is required'),
  type: z.string().min(1, 'type is required'),
});

export const updateLeaveStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const generatePayrollSchema = z.object({
  schoolId: z.string().optional(),
  month: z.string().regex(MONTH_REGEX, 'Invalid month format (expected YYYY-MM)'),
});
