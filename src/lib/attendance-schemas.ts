// ==============================================================================
// Zod schemas for the Attendance API contract (Module 7).
// `schoolId` is optional on the mark body because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a tenant.
// ==============================================================================

import { z } from 'zod';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT'] as const;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((val) => !Number.isNaN(new Date(val + 'T00:00:00.000Z').getTime()), {
    message: 'date must be a valid calendar date',
  });

export const markAttendanceSchema = z.object({
  schoolId: z.string().optional(),
  courseId: z.string().min(1),
  date: isoDateSchema,
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
      })
    )
    .min(1, 'records must not be empty'),
});

/**
 * Body for `POST /api/attendance/update` — flip a single student's status for a
 * given course+date (drill-down teacher edit). `schoolId` required only for
 * Central officers.
 */
export const updateAttendanceSchema = z.object({
  schoolId: z.string().optional(),
  courseId: z.string().min(1),
  studentId: z.string().min(1),
  date: isoDateSchema,
  status: z.enum(ATTENDANCE_STATUSES),
});
