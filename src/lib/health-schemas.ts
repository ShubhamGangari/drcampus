// ==============================================================================
// Zod schemas for the Health & Medical Centre API contract (Batch B).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const HEALTH_VISIT_TYPES = ['OPD', 'FOLLOW_UP'] as const;
export const HEALTH_VISIT_STATUSES = ['SCHEDULED', 'COMPLETED', 'FOLLOW_UP_REQUIRED'] as const;

export const updateRecordSchema = z.object({
    schoolId: z.string().optional(),
    bloodGroup: z.string().max(20).optional().nullable(),
    allergies: z.string().max(500).optional().nullable(),
    chronicConditions: z.string().max(500).optional().nullable(),
    emergencyContact: z.string().max(50).optional().nullable(),
});

export const createVisitSchema = z.object({
    schoolId: z.string().optional(),
    studentId: z.string().min(1, 'studentId is required'),
    date: z.string().datetime({ offset: true }).optional(),
    type: z.enum(HEALTH_VISIT_TYPES, {
        error: 'type must be OPD or FOLLOW_UP',
    }).default('OPD'),
    symptoms: z.string().min(1, 'symptoms is required').max(1000),
    diagnosis: z.string().max(1000).optional().nullable(),
    prescription: z.string().max(1000).optional().nullable(),
    status: z.enum(HEALTH_VISIT_STATUSES, {
        error: 'status must be SCHEDULED, COMPLETED or FOLLOW_UP_REQUIRED',
    }).optional(),
    followUpDate: z.string().datetime({ offset: true }).optional().nullable(),
});

export const updateVisitSchema = z.object({
    schoolId: z.string().optional(),
    status: z.enum(HEALTH_VISIT_STATUSES, {
        error: 'status must be SCHEDULED, COMPLETED or FOLLOW_UP_REQUIRED',
    }).optional(),
    prescription: z.string().max(1000).optional().nullable(),
    followUpDate: z.string().datetime({ offset: true }).optional().nullable(),
});
