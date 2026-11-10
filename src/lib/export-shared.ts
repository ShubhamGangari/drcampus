// ==============================================================================
// Shared export payload builder (server-side).
//
// Turns a ReportTable (columns + rows) into the same success payload shape the
// Reports Center export uses: `{ filename, content, contentType }`. CSV export
// reuses `reportToCsv`; PDF export is represented as a print-friendly HTML view
// (`reportToPrintHtml`) that the browser can print/save as PDF — the same
// convention as GET /api/reports/center/export.
// ==============================================================================

import { reportToCsv, reportToPrintHtml } from './reports-center-core';
import type { ReportTable } from './reports-center-core';
import { successResponse } from './api';

export type ExportFormat = 'csv' | 'pdf';

/**
 * Wrap a report table in the standard export success payload for the given
 * format. `slug` becomes the base filename (e.g. `students` -> `students.csv`).
 */
export function buildExportPayload(table: ReportTable, fmt: ExportFormat, slug: string) {
    if (fmt === 'csv') {
        return successResponse({
            filename: `${slug}.csv`,
            content: reportToCsv(table),
            contentType: 'text/csv',
        });
    }
    return successResponse({
        filename: `${slug}.html`,
        content: reportToPrintHtml(table),
        contentType: 'text/html',
    });
}
