// ==============================================================================
// Zod schemas for the Certificates & Documents API contract (Batch A).
// Mirrors docs/specs/certificates.md §4. `schoolId` is optional on create
// bodies because school-scoped users never send it; central officers (schoolId
// 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const CERTIFICATE_TYPES = [
    'TC',
    'MIGRATION',
    'CHARACTER',
    'BONAFIDE',
    'PROVISIONAL_DEGREE',
] as const;

export const CERTIFICATE_UPDATE_STATUSES = [
    'APPROVED',
    'REJECTED',
    'ISSUED',
] as const;

export const createCertificateSchema = z.object({
    schoolId: z.string().optional(),
    type: z.enum(CERTIFICATE_TYPES, { error: 'invalid certificate type' }),
    purpose: z.string().max(500).optional().nullable(),
});

export const updateCertificateSchema = z.object({
    status: z.enum(CERTIFICATE_UPDATE_STATUSES, { error: 'invalid target status' }),
    remark: z.string().max(1000).optional().nullable(),
    schoolId: z.string().optional(),
});
