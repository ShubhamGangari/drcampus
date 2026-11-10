// ==============================================================================
// Zod schemas for the Reports Center API contract (Batch E).
// The saved-report create body is the only mutable input; `type` must be one of
// the whitelisted report types and `filters` is an opaque JSON object that the
// server stores verbatim (escaped only on the way out).
// ==============================================================================

import { z } from 'zod';
import { REPORT_TYPES, type ReportType } from './reports-center-core';

const REPORT_TYPE_KEYS = REPORT_TYPES.map((t) => t.key) as [ReportType, ...ReportType[]];

export const createSavedReportSchema = z.object({
    name: z.string().trim().min(1, 'name is required').max(120, 'name is too long'),
    type: z.enum(REPORT_TYPE_KEYS),
    filters: z.record(z.string(), z.unknown()).optional(),
});

export type CreateSavedReportInput = z.infer<typeof createSavedReportSchema>;
