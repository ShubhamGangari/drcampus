// ==============================================================================
// Zod schemas for the Placement Cell API contract (Batch D).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';
import { VALID_PLACEMENT_STATUSES } from './placement-core';

// ---- Companies ----------------------------------------------------------------

export const createCompanySchema = z.object({
    schoolId: z.string().optional(),
    name: z.string().min(1, 'Company name is required').max(200),
    sector: z.string().max(120).optional(),
});

export const updateCompanySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    sector: z.string().max(120).nullable().optional(),
}).refine((v) => v.name !== undefined || v.sector !== undefined, {
    message: 'Provide at least one field to update',
});

// ---- Drives -------------------------------------------------------------------

export const createDriveSchema = z.object({
    schoolId: z.string().optional(),
    title: z.string().min(1, 'Drive title is required').max(200),
    date: z.string().datetime({ offset: true }),
    mode: z.enum(['ONLINE', 'OFFLINE']),
    role: z.string().min(1, 'Role is required').max(200),
    package: z.string().max(120).optional(),
    location: z.string().max(200).optional(),
});

// ---- Posts --------------------------------------------------------------------

export const createPostSchema = z.object({
    schoolId: z.string().optional(),
    title: z.string().min(1, 'Post title is required').max(200),
    companyId: z.string().min(1, 'companyId is required'),
    driveId: z.string().min(1).optional(),
    package: z.string().max(120).optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    eligibility: z.string().max(500).optional(),
});

// ---- Self-service application --------------------------------------------------

export const createApplicationSchema = z.object({
    schoolId: z.string().optional(),
    postId: z.string().min(1, 'postId is required'),
});

// ---- Admin status update -------------------------------------------------------

export const updateApplicationStatusSchema = z.object({
    status: z.enum(VALID_PLACEMENT_STATUSES as unknown as [string, ...string[]]),
});
