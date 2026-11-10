// ==============================================================================
// Zod schemas for the Course & Semester Registration API contract (Batch C).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

// ---- Windows ------------------------------------------------------------------

export const createWindowSchema = z.object({
    schoolId: z.string().optional(),
    semester: z.number().int().min(1, 'semester must be >= 1').max(12, 'semester must be <= 12'),
    academicYear: z.string().min(4, 'academicYear is required').max(20),
    opensAt: z.string().datetime({ offset: true }),
    closesAt: z.string().datetime({ offset: true }),
});

// ---- Self-service registration -------------------------------------------------

export const registerCoursesSchema = z.object({
    schoolId: z.string().optional(),
    courseIds: z.array(z.string().min(1)).min(1, 'Select at least one course').max(20, 'Too many courses in one request'),
});

export const dropCourseSchema = z.object({
    courseId: z.string().min(1, 'courseId is required'),
});
