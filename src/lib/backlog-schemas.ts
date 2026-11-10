// ==============================================================================
// Zod schemas for the Backlog & Revaluation API contract (Batch C).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

// ---- Self-service revaluation request ------------------------------------------

export const revaluationRequestSchema = z.object({
    reason: z.string().min(3, 'reason must be at least 3 characters').max(500),
});

// ---- Admin revaluation review ---------------------------------------------------

export const REVALUATION_ADMIN_STATUSES = ['APPROVED', 'COMPLETED', 'REJECTED'] as const;

export const updateRevaluationSchema = z.object({
    status: z.enum(REVALUATION_ADMIN_STATUSES, {
        error: `status must be one of ${REVALUATION_ADMIN_STATUSES.join(', ')}`,
    }),
    remark: z.string().max(500).optional().nullable(),
});

// ---- Supplementary exams (admin) ------------------------------------------------

export const createExamSchema = z.object({
    schoolId: z.string().optional(),
    courseId: z.string().min(1, 'courseId is required'),
    scheduleDate: z.string().datetime({ offset: true }),
    venue: z.string().max(200).optional().nullable(),
});

export const registerExamSchema = z.object({
    studentId: z.string().min(1, 'studentId is required'),
});
