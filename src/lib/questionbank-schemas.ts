// ==============================================================================
// Zod schemas for the Question Bank & Exam Duty API contract (Batch C).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const QUESTION_TYPES = ['MCQ', 'SHORT', 'LONG', 'VIVA'] as const;
export const QUESTION_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

// ---- Questions ------------------------------------------------------------------

export const createQuestionSchema = z.object({
    schoolId: z.string().optional(),
    courseId: z.string().min(1, 'courseId is required'),
    unit: z.string().max(50).optional().nullable(),
    type: z.enum(QUESTION_TYPES, {
        error: `type must be one of ${QUESTION_TYPES.join(', ')}`,
    }),
    difficulty: z.enum(QUESTION_DIFFICULTIES, {
        error: `difficulty must be one of ${QUESTION_DIFFICULTIES.join(', ')}`,
    }).default('MEDIUM'),
    content: z.string().min(5, 'content must be at least 5 characters').max(2000),
});

export const QUESTION_ADMIN_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED'] as const;

export const updateQuestionSchema = z.object({
    status: z.enum(QUESTION_ADMIN_STATUSES, {
        error: `status must be one of ${QUESTION_ADMIN_STATUSES.join(', ')}`,
    }),
    remark: z.string().max(500).optional().nullable(),
});

// ---- Exam duty (admin) ------------------------------------------------------------

export const createDutySchema = z.object({
    schoolId: z.string().optional(),
    examId: z.string().min(1, 'examId is required'),
    facultyUserId: z.string().min(1, 'facultyUserId is required'),
    date: z.string().datetime({ offset: true }),
    venue: z.string().max(200).optional().nullable(),
    role: z.string().max(100).optional().default('INVIGILATOR'),
});
