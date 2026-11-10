// ==============================================================================
// Zod schemas for the Grade Cards & Transcripts API contract (Batch C).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const TRANSCRIPT_TYPES = ['SEMESTER', 'FULL'] as const;

// ---- Transcript issuance (admin) ----------------------------------------------

export const issueTranscriptSchema = z.object({
    schoolId: z.string().optional(),
    studentId: z.string().min(1, 'studentId is required'),
    type: z.enum(TRANSCRIPT_TYPES, {
        error: 'type must be SEMESTER or FULL',
    }).default('FULL'),
    semester: z.number().int().min(1).optional(),
});

// ---- Public verification -------------------------------------------------------

export const verifyTranscriptSchema = z.object({
    transcriptNo: z.string().min(1, 'transcriptNo is required'),
});
