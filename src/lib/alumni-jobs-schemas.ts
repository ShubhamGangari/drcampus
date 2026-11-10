// ==============================================================================
// Zod schemas for the Alumni Jobs Board API contract (Batch D).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';
import { VALID_JOB_STATUSES, VALID_JOB_TYPES } from './alumni-jobs-core';

// ---- Create a job (alumni / alumniJobs.post) ---------------------------------

export const createJobSchema = z.object({
    schoolId: z.string().optional(),
    title: z.string().min(1, 'Title is required').max(200),
    company: z.string().min(1, 'Company is required').max(200),
    location: z.string().max(200).optional(),
    type: z.enum(VALID_JOB_TYPES as unknown as [string, ...string[]]),
    description: z.string().min(1, 'Description is required').max(2000),
    contact: z.string().min(1, 'Contact is required').max(300),
});

// ---- Self-service application --------------------------------------------------

export const applyJobSchema = z.object({
    schoolId: z.string().optional(),
    jobId: z.string().min(1, 'jobId is required'),
});

// ---- Admin status update -------------------------------------------------------

export const updateJobStatusSchema = z.object({
    status: z.enum(VALID_JOB_STATUSES as unknown as [string, ...string[]]),
});
