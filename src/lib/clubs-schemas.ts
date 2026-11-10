// ==============================================================================
// Zod schemas for the Clubs, Societies & Events API contract (Batch B).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const CLUB_CATEGORIES = [
    'TECHNICAL',
    'CULTURAL',
    'SPORTS',
    'LITERARY',
    'SOCIAL',
    'OTHER',
] as const;
export const CLUB_EVENT_STATUSES = ['UPCOMING', 'COMPLETED', 'CANCELLED'] as const;

export const createClubSchema = z.object({
    schoolId: z.string().optional(),
    name: z.string().min(1, 'name is required').max(200),
    category: z.enum(CLUB_CATEGORIES, {
        error: 'category must be TECHNICAL, CULTURAL, SPORTS, LITERARY, SOCIAL or OTHER',
    }),
    description: z.string().max(1000).optional().nullable(),
    coordinatorUserId: z.string().optional().nullable(),
});

export const updateClubSchema = z.object({
    schoolId: z.string().optional(),
    name: z.string().min(1).max(200).optional(),
    category: z.enum(CLUB_CATEGORIES).optional(),
    description: z.string().max(1000).optional().nullable(),
    coordinatorUserId: z.string().optional().nullable(),
});

export const memberActionSchema = z.object({
    action: z.enum(['JOIN', 'LEAVE'], {
        error: 'action must be JOIN or LEAVE',
    }),
});

export const createEventSchema = z.object({
    schoolId: z.string().optional(),
    clubId: z.string().min(1, 'clubId is required'),
    title: z.string().min(1, 'title is required').max(200),
    date: z.string().datetime({ offset: true }),
    venue: z.string().max(200).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
});

export const updateEventSchema = z.object({
    schoolId: z.string().optional(),
    title: z.string().min(1).max(200).optional(),
    date: z.string().datetime({ offset: true }).optional(),
    venue: z.string().max(200).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    status: z.enum(CLUB_EVENT_STATUSES, {
        error: 'status must be UPCOMING, COMPLETED or CANCELLED',
    }).optional(),
});
