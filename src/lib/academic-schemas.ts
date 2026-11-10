// ==============================================================================
// Zod schemas for the Academic Calendar & Timetable API contract (Deep Core).
// Mirrors docs/specs/academic-schedule.md §4 (FROZEN).
//
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a tenant.
// ==============================================================================

import { z } from 'zod';

export const EVENT_TYPES = ['HOLIDAY', 'EXAM', 'EVENT', 'DEADLINE'] as const;
export const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6] as const;

const academicYearSchema = z.string().regex(/^\d{4}-\d{4}$/, 'academicYear must be YYYY-YYYY');

const dateStringSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.length > 0 ? val : undefined),
  z.string().refine((val) => !Number.isNaN(new Date(val).getTime()), {
    message: 'must be a valid date string',
  })
);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'time must be HH:mm in 24h format');

// ---- Calendar events ----------------------------------------------------------

export const createEventSchema = z
  .object({
    schoolId: z.string().optional(),
    programId: z.string().min(1).nullable().optional(),
    title: z.string().min(1).max(200),
    type: z.enum(EVENT_TYPES),
    startDate: dateStringSchema,
    endDate: dateStringSchema.nullable().optional(),
  })
  .refine((v) => v.endDate == null || new Date(v.startDate).getTime() <= new Date(v.endDate).getTime(), {
    message: 'startDate must be on or before endDate',
    path: ['endDate'],
  });

export const updateEventSchema = z
  .object({
    programId: z.string().min(1).nullable().optional(),
    title: z.string().min(1).max(200).optional(),
    type: z.enum(EVENT_TYPES).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' })
  .refine(
    (v) => v.startDate == null || v.endDate == null || new Date(v.startDate).getTime() <= new Date(v.endDate).getTime(),
    { message: 'startDate must be on or before endDate', path: ['endDate'] }
  );

// ---- Timetable slots ----------------------------------------------------------

export const createSlotSchema = z
  .object({
    schoolId: z.string().optional(),
    classGroupId: z.string().min(1),
    dayOfWeek: z.number().int().min(1).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
    courseId: z.string().min(1),
    facultyUserId: z.string().min(1),
    room: z.string().min(1).max(100).nullable().optional(),
    semester: z.number().int().min(1),
    academicYear: academicYearSchema,
  })
  // Both times are normalized "HH:mm" (same length), so lexicographic ordering
  // equals chronological ordering.
  .refine((v) => v.endTime > v.startTime, { message: 'endTime must be after startTime', path: ['endTime'] });
