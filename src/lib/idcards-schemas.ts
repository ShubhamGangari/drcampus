// ==============================================================================
// Zod schemas for the ID Cards API contract (Batch E).
// Mirrors docs/specs/id-cards.md §4. `schoolId` is optional on generate bodies
// because school-scoped users never send it; central officers (schoolId 'ALL')
// must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';
import { HOLDER_TYPES } from './idcards-core';

export const HOLDER_TYPE_KEYS = [
    HOLDER_TYPES.STUDENT,
    HOLDER_TYPES.STAFF,
] as const;

export const generateCardsSchema = z.object({
    holderType: z.enum(HOLDER_TYPE_KEYS, { error: 'invalid holder type' }),
    studentIds: z.array(z.string().min(1)).optional(),
    staffIds: z.array(z.string().min(1)).optional(),
    batchId: z.string().min(1).optional(),
    schoolId: z.string().optional(),
});

export type GenerateCardsInput = z.infer<typeof generateCardsSchema>;
