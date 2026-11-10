// ==============================================================================
// Cross-cutting infrastructure (Deep Core) — pure, DB-free business logic for
// audit log, notifications, global search and KPI widgets. Everything here is
// unit-testable without a database, mirroring the academic/fees core pattern.
//
// Spec: docs/specs/cross-cutting-infra.md
// ==============================================================================

import { ApiError } from './errors';

/** Parse & validate a pagination `limit` query value. Throws 400 on invalid. */
export function parseLimit(
    raw: string | null,
    def = 25,
    max = 100
): number {
    const n = raw == null || raw === '' ? def : Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > max) {
        throw new ApiError(
            400,
            'INVALID_LIMIT',
            `limit must be an integer between 1 and ${max}`
        );
    }
    return n;
}

/**
 * Attendance % for a single day: present / (present + absent + od) × 100,
 * rounded to 1 decimal. Returns 0 when there are no records for the day.
 */
export function calculateAttendancePercent(
    present: number,
    absent: number,
    od: number
): number {
    const total = present + absent + od;
    if (total <= 0) return 0;
    return Math.round((present / total) * 1000) / 10;
}

/** Mean of a list of attainment values, rounded to 2 decimals. 0 on empty. */
export function meanAttainment(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 100) / 100;
}

/** Trim + lowercase a search term for a normalized contains match. */
export function normalizeSearchTerm(q: string): string {
    return q.trim().toLowerCase();
}

/** A search query is usable when it is ≥ 2 characters after trimming. */
export function isSearchable(q: unknown): q is string {
    return typeof q === 'string' && q.trim().length >= 2;
}
