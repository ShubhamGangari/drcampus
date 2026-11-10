// ==============================================================================
// Zod schemas for the Dean Oversight API contract (docs/specs/dean-overview.md).
// `schoolId` is optional because school-scoped users never send it; central
// officers (schoolId 'ALL') must send it to select a tenant.
// ==============================================================================

import { z } from 'zod';
import { PRESENCE_STATUSES } from './governance-core';

const isoDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .refine((val) => !Number.isNaN(new Date(val + 'T00:00:00.000Z').getTime()), {
        message: 'date must be a valid calendar date',
    });

/** Body for `POST /api/governance/faculty-presence` — upsert a daily presence row. */
export const facultyPresenceSchema = z.object({
    schoolId: z.string().optional(),
    userId: z.string().min(1),
    date: isoDateSchema,
    status: z.enum(PRESENCE_STATUSES),
});

/** Body for `POST /api/governance/message` — in-app message to faculty/staff. */
export const messageSchema = z.object({
    schoolId: z.string().optional(),
    recipientUserIds: z.array(z.string().min(1)).min(1, 'at least one recipient required'),
    subject: z.string().min(1, 'subject is required'),
    body: z.string().optional(),
    link: z.string().optional(),
});
