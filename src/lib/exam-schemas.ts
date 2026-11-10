// ==============================================================================
// Zod schemas for the Examination & Result API contract (Module 4).
// `schoolId` is optional on the exam-create body because school-scoped users never
// send it; central officers (schoolId 'ALL') must send it to select a tenant.
// ==============================================================================

import { z } from 'zod';

export const EXAM_TYPES = ['MID_SEM', 'END_SEM'] as const;
export const EXAM_STATUSES = ['DRAFT', 'SCHEDULED', 'COMPLETED', 'PUBLISHED'] as const;

const academicYearSchema = z.string().regex(/^\d{4}-\d{4}$/, 'academicYear must be YYYY-YYYY');

const dateStringSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.length > 0 ? val : undefined),
  z.string().refine((val) => !Number.isNaN(new Date(val).getTime()), {
    message: 'examDate must be a valid date string',
  })
);

export const createExamSchema = z.object({
  schoolId: z.string().optional(),
  programId: z.string().min(1),
  academicYear: academicYearSchema,
  semester: z.number().int().min(1).max(12),
  type: z.enum(EXAM_TYPES),
  title: z.string().min(1).max(200),
  maxInternal: z.number().min(0),
  maxExternal: z.number().min(0),
});

export const createScheduleSchema = z.object({
  courseId: z.string().min(1),
  examDate: dateStringSchema,
  startTime: z.string().min(1).max(20),
  venue: z.string().min(1).max(200),
});

export const updateScheduleSchema = z
  .object({
    examDate: dateStringSchema.optional(),
    startTime: z.string().min(1).max(20).optional(),
    venue: z.string().min(1).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'No fields to update',
  });

export const generateHallTicketSchema = z.object({
  studentId: z.string().min(1),
});

export const marksEntrySchema = z.object({
  studentId: z.string().min(1),
  scheduleId: z.string().min(1),
  internalMarks: z.number().min(0),
  externalMarks: z.number().min(0),
});

export const publishSchema = z.object({}).strict();
