// ==============================================================================
// Dean Oversight — pure helpers (live classes, presence resolution).
// Spec: docs/specs/dean-overview.md. These are side-effect free so the tester can
// unit-test them without a database.
// ==============================================================================

export const PRESENCE_STATUSES = ['PRESENT', 'ABSENT', 'ON_LEAVE'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];
export type ResolvedPresenceStatus = PresenceStatus | 'UNMARKED';

/** Day-of-week constants matching TimetableSlot.dayOfWeek (1=Mon .. 6=Sat). */
export const MONDAY = 1;
export const SATURDAY = 6;

/** "HH:mm" (24h) -> minutes since midnight. */
export function minutesFromMidnight(time: string): number {
    const [h, m] = time.split(':').map((n) => Number.parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return h * 60 + m;
}

export type LiveSlotStatus = 'LIVE' | 'UPCOMING';

export interface LiveSlotInput {
    dayOfWeek: number; // 1=Mon .. 6=Sat
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
}

/**
 * Classify a timetable slot against a "now" reference (day + minutes since
 * midnight).
 *  - "LIVE"    -> now is within [start, end).
 *  - "UPCOMING"-> now is before start and start is within the next 60 minutes.
 *  - null       -> different day, ended, or further than 60 min away.
 */
export function classifyLiveSlot(
    slot: LiveSlotInput,
    nowDay: number,
    nowMinutes: number
): LiveSlotStatus | null {
    if (slot.dayOfWeek !== nowDay) return null;
    const s = minutesFromMidnight(slot.startTime);
    const e = minutesFromMidnight(slot.endTime);
    if (nowMinutes >= s && nowMinutes < e) return 'LIVE';
    if (nowMinutes < s && s - nowMinutes <= 60) return 'UPCOMING';
    return null;
}

/**
 * Resolve a faculty's presence status for a day: an explicit persisted row wins;
 * otherwise the day is "UNMARKED" (not persisted).
 */
export function resolvePresenceStatus(explicit: PresenceStatus | null | undefined): ResolvedPresenceStatus {
    return explicit ?? 'UNMARKED';
}

export interface NowRef {
    dayOfWeek: number; // 1=Mon .. 6=Sat (7 = Sun, not used by timetable)
    minutes: number;
}

/**
 * Compute the wall-clock "day-of-week + minutes-since-midnight" in a given IANA
 * time zone for an absolute instant. This lets live-class classification match
 * the school's local timetable rather than the server's UTC clock.
 */
export function nowInZone(date: Date, timeZone: string): NowRef {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
    const parts = fmt.formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const DAY_MAP: Record<string, number> = {
        Sun: 7,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };
    const dayOfWeek = DAY_MAP[get('weekday')] ?? 7;
    const minutes = Number.parseInt(get('hour'), 10) * 60 + Number.parseInt(get('minute'), 10);
    return { dayOfWeek, minutes };
}

/** IANA zone used by CampusERP schools (India). */
export const IST_ZONE = 'Asia/Kolkata';

/** Convenience: current IST day + minutes. */
export function istNow(): NowRef {
    return nowInZone(new Date(), IST_ZONE);
}

export function dateInZone(
    date: Date,
    timeZone: string
): { year: number; month: number; day: number } {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = fmt.formatToParts(date);
    const get = (t: string) =>
        Number.parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
    return { year: get('year'), month: get('month'), day: get('day') };
}

export function dateStringInZone(date: Date, timeZone: string): string {
    const d = dateInZone(date, timeZone);
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}
