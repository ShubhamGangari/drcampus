// ==============================================================================
// Zod schemas for the Notices & Circulars API contract (Batch A).
// Mirrors docs/specs/notices.md §4. `schoolId` is optional on create bodies
// because school-scoped users never send it; central officers (schoolId 'ALL')
// must send it to select a target tenant. `expiresAt` travels as an ISO string
// and is converted to a Date by the route.
// ==============================================================================

import { z } from 'zod';

export const NOTICE_CATEGORIES = [
    'EXAM',
    'FEE',
    'HOLIDAY',
    'EVENT',
    'GENERAL',
] as const;

export const noticeAudienceSchema = z
    .object({
        roles: z.array(z.string()).optional(),
        schoolIds: z.array(z.string()).optional(),
    })
    .optional();

export const createNoticeSchema = z.object({
    schoolId: z.string().optional(),
    title: z.string().min(1).max(200),
    category: z.enum(NOTICE_CATEGORIES, { error: 'invalid notice category' }),
    body: z.string().min(1),
    audience: noticeAudienceSchema,
    pinned: z.boolean().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
});

export const updateNoticeSchema = z.object({
    schoolId: z.string().optional(),
    title: z.string().min(1).max(200).optional(),
    category: z.enum(NOTICE_CATEGORIES, { error: 'invalid notice category' }).optional(),
    body: z.string().min(1).optional(),
    pinned: z.boolean().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
});
