// ==============================================================================
// Zod schemas for the Scholarships & Concessions API contract (Batch B).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const SCHOLARSHIP_TYPES = ['MERIT', 'NEED_BASED', 'CATEGORY', 'SPORTS'] as const;
export const SCHOLARSHIP_VALUE_KINDS = ['AMOUNT', 'PERCENT'] as const;
export const SCHOLARSHIP_APP_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED'] as const;

export const createSchemeSchema = z.object({
    schoolId: z.string().optional(),
    name: z.string().min(1, 'name is required').max(200),
    type: z.enum(SCHOLARSHIP_TYPES, {
        error: 'type must be MERIT, NEED_BASED, CATEGORY or SPORTS',
    }),
    value: z.number().min(0, 'value must be non-negative'),
    valueKind: z.enum(SCHOLARSHIP_VALUE_KINDS, {
        error: 'valueKind must be AMOUNT or PERCENT',
    }).default('AMOUNT'),
    criteriaJson: z.string().default('{}'),
});

export const updateSchemeSchema = z.object({
    schoolId: z.string().optional(),
    name: z.string().min(1).max(200).optional(),
    type: z.enum(SCHOLARSHIP_TYPES).optional(),
    value: z.number().min(0).optional(),
    valueKind: z.enum(SCHOLARSHIP_VALUE_KINDS).optional(),
    criteriaJson: z.string().optional(),
    active: z.boolean().optional(),
});

export const createApplicationSchema = z.object({
    schoolId: z.string().optional(),
    schemeId: z.string().min(1, 'schemeId is required'),
    notes: z.string().max(1000).optional().nullable(),
});

export const updateApplicationSchema = z.object({
    schoolId: z.string().optional(),
    status: z.enum(SCHOLARSHIP_APP_STATUSES, {
        error: 'status must be SUBMITTED, APPROVED or REJECTED',
    }),
    remark: z.string().max(1000).optional().nullable(),
});
