// ==============================================================================
// Zod schemas for the Mentorship API contract (Batch D).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

// ---- Student requests a mentor -------------------------------------------------

export const createMentorshipRequestSchema = z.object({
    schoolId: z.string().optional(),
    mentorId: z.string().min(1, 'mentorId is required'),
    message: z.string().max(1000).optional(),
});

// ---- Mentor responds to a request (ACCEPT | REJECT) ----------------------------

export const updateMentorshipRequestSchema = z.object({
    action: z.enum(['ACCEPT', 'REJECT']),
});

// ---- Admin force-creates a pairing ---------------------------------------------

export const createPairingSchema = z.object({
    schoolId: z.string().optional(),
    mentorId: z.string().min(1, 'mentorId is required'),
    studentId: z.string().min(1, 'studentId is required'),
});

// ---- Log a meeting against an ACTIVE pairing ------------------------------------

export const createMeetingSchema = z.object({
    schoolId: z.string().optional(),
    pairingId: z.string().min(1, 'pairingId is required'),
    date: z.coerce.date(),
    notes: z.string().max(2000).optional(),
});
