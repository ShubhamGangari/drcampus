// ==============================================================================
// Zod schemas for the Parent Portal API contract (Batch E).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const createLinkSchema = z.object({
    schoolId: z.string().optional(),
    parentUserId: z.string().min(1, 'parentUserId is required'),
    studentId: z.string().min(1, 'studentId is required'),
});
