// ==============================================================================
// Zod schemas for the Library Management API contract (Batch A).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const MEMBERSHIP_TYPES = ['STUDENT', 'STAFF'] as const;

// ---- Catalogue ----------------------------------------------------------------

export const createBookSchema = z.object({
    schoolId: z.string().optional(),
    title: z.string().min(1, 'title is required').max(300),
    author: z.string().min(1, 'author is required').max(200),
    isbn: z.string().max(50).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    shelf: z.string().max(100).optional().nullable(),
    totalCopies: z.number().int().min(1, 'totalCopies must be at least 1').max(10000).optional(),
});

export const updateBookSchema = z.object({
    title: z.string().min(1).max(300).optional(),
    author: z.string().min(1).max(200).optional(),
    isbn: z.string().max(50).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    shelf: z.string().max(100).optional().nullable(),
    totalCopies: z.number().int().min(1).max(10000).optional(),
    schoolId: z.string().optional(),
});

// ---- Circulation --------------------------------------------------------------

export const issueLoanSchema = z.object({
    schoolId: z.string().optional(),
    memberId: z.string().min(1, 'memberId is required'),
    copyId: z.string().min(1, 'copyId is required'),
    dueDate: z.string().datetime({ offset: true }).optional(),
});

export const returnLoanSchema = z.object({
    fine: z.number().min(0).optional(),
});

// ---- Memberships --------------------------------------------------------------

export const createMembershipSchema = z.object({
    schoolId: z.string().optional(),
    userId: z.string().min(1, 'userId is required'),
    type: z.enum(MEMBERSHIP_TYPES, {
        error: 'type must be STUDENT or STAFF',
    }).default('STUDENT'),
});

export const updateMembershipSchema = z.object({
    active: z.boolean().optional(),
    type: z.enum(MEMBERSHIP_TYPES, {
        error: 'type must be STUDENT or STAFF',
    }).optional(),
});
