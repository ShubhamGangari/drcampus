// ==============================================================================
// Zod schemas for the Internships API contract (Batch D).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';
import { VALID_INTERNSHIP_STATUSES } from './internships-core';

// ---- Listings ----------------------------------------------------------------

export const createListingSchema = z.object({
    schoolId: z.string().optional(),
    role: z.string().min(1, 'Role is required').max(200),
    companyName: z.string().min(1, 'Company name is required').max(200),
    mode: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']),
    duration: z.string().min(1, 'Duration is required').max(120),
    stipend: z.string().max(120).optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    description: z.string().max(1000).optional(),
});

export const updateListingSchema = z.object({
    role: z.string().min(1).max(200).optional(),
    companyName: z.string().min(1).max(200).optional(),
    mode: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).optional(),
    duration: z.string().min(1).max(120).optional(),
    stipend: z.string().max(120).nullable().optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    description: z.string().max(1000).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
});

// ---- Self-service application --------------------------------------------------

export const createInternshipApplicationSchema = z.object({
    schoolId: z.string().optional(),
    listingId: z.string().min(1, 'listingId is required'),
});

// ---- Admin status update -------------------------------------------------------

export const updateInternshipStatusSchema = z.object({
    status: z.enum(VALID_INTERNSHIP_STATUSES as unknown as [string, ...string[]]),
    startDate: z.string().datetime({ offset: true }).nullable().optional(),
    endDate: z.string().datetime({ offset: true }).nullable().optional(),
    certificateNo: z.string().max(200).nullable().optional(),
});
