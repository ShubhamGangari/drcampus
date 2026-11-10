// ==============================================================================
// Cross-cutting infrastructure — Zod request schemas.
// Spec: docs/specs/cross-cutting-infra.md §4
// ==============================================================================

import { z } from 'zod';

/** System/Admin notification send body (POST /api/notifications/send). */
export const sendNotificationSchema = z.object({
    recipientUserId: z.string().min(1),
    type: z.string().min(1).max(40),
    title: z.string().min(1).max(120),
    body: z.string().max(500).optional(),
    link: z.string().max(255).optional(),
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
