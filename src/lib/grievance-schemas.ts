// ==============================================================================
// Zod schemas for the Grievance & Helpdesk API contract (Batch B).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const GRIEVANCE_CATEGORIES = [
    'ACADEMIC',
    'HOSTEL',
    'FEES',
    'TRANSPORT',
    'GENERAL',
] as const;
export const GRIEVANCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const GRIEVANCE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export const createGrievanceSchema = z.object({
    schoolId: z.string().optional(),
    category: z.enum(GRIEVANCE_CATEGORIES, {
        error: 'category must be ACADEMIC, HOSTEL, FEES, TRANSPORT or GENERAL',
    }),
    subject: z.string().min(1, 'subject is required').max(200),
    description: z.string().min(1, 'description is required').max(2000),
    priority: z.enum(GRIEVANCE_PRIORITIES, {
        error: 'priority must be LOW, MEDIUM, HIGH or URGENT',
    }).optional(),
});

export const updateGrievanceSchema = z.object({
    schoolId: z.string().optional(),
    status: z.enum(GRIEVANCE_STATUSES, {
        error: 'status must be OPEN, IN_PROGRESS, RESOLVED or CLOSED',
    }).optional(),
    priority: z.enum(GRIEVANCE_PRIORITIES, {
        error: 'priority must be LOW, MEDIUM, HIGH or URGENT',
    }).optional(),
    assigneeUserId: z.string().optional().nullable(),
    resolution: z.string().max(2000).optional().nullable(),
});

export const createGrievanceMessageSchema = z.object({
    body: z.string().min(1, 'body is required').max(2000),
});
