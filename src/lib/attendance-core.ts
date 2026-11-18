// ==============================================================================
// Attendance module (Module 7) — backend business logic.
// Pure functions (attendance percentage) live here so the tester can unit-test
// them without a database. Thin DB helpers (tenant resolution, course/student
// ownership asserts) are reused from earlier modules and re-exported here.
//
// Multi-tenant model:
//   - school-scoped users use the extended client (auto-injects schoolId);
//   - central 'ALL' controllers use the base client and resolve a tenant from
//     body.schoolId (mark) or the query string (report/defaulter).
// ==============================================================================

import type { Db } from './prisma';
import { ApiError } from './errors';

export { resolveCreateTenant } from './fee-core';
export { assertCourseBelongsToSchool } from './exam-core';
export { assertStudentBelongsToSchool } from './fee-core';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Attendance percentage for a student over `totalDays` class days, rounded to
 * 2 decimal places.
 * - `present`    number of PRESENT records
 * - `totalDays`  number of distinct attendance days (records)
 * Returns `null` when totalDays is 0 so callers omit the row (spec §6.1).
 */
export function computeAttendancePercentage(
  present: number,
  totalDays: number
): number | null {
  const p = Number(present) || 0;
  const t = Number(totalDays) || 0;
  if (t <= 0) return null;
  return round2((p / t) * 100);
}

export interface AttendanceRow {
  studentId: string;
  rollNo: string;
  name: string;
  totalDays: number;
  presentDays: number;
  percentage: number | null;
}

/**
 * Aggregates raw attendance records (already tenant-scoped by the caller) into
 * per-student report rows, joining student names via `db.student`. Rows with 0
 * total days are omitted (they cannot occur because records exist per grouping).
 * Result is sorted by rollNo for deterministic output.
 */
export async function buildAttendanceRows(
  db: Db,
  records: Array<{ studentId: string; status: string }>
): Promise<AttendanceRow[]> {
  const agg = new Map<string, { present: number; total: number }>();
  for (const r of records) {
    const g = agg.get(r.studentId) ?? { present: 0, total: 0 };
    g.total++;
    // UGC/AICTE standard: DUTY_LEAVE (OD/On-Duty representation) and LATE count towards presence credit
    if (r.status === 'PRESENT' || r.status === 'DUTY_LEAVE' || r.status === 'LATE') g.present++;
    agg.set(r.studentId, g);
  }

  const ids = Array.from(agg.keys());
  const students: Array<{ id: string; rollNo: string; firstName: string; lastName: string }> =
    ids.length
      ? await db.student.findMany({
        where: { id: { in: ids } },
        select: { id: true, rollNo: true, firstName: true, lastName: true },
      })
      : [];
  const studentMap = new Map<string, { id: string; rollNo: string; firstName: string; lastName: string }>();
  for (const s of students) studentMap.set(s.id, s);

  const rows: AttendanceRow[] = ids.map((id) => {
    const g = agg.get(id)!;
    const s = studentMap.get(id);
    return {
      studentId: id,
      rollNo: s?.rollNo ?? '',
      name: s ? `${s.firstName} ${s.lastName}` : '',
      totalDays: g.total,
      presentDays: g.present,
      percentage: computeAttendancePercentage(g.present, g.total),
    };
  });

  rows.sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  return rows;
}

export interface TeacherSummaryInput {
  date: string;
  markedById: string | null;
}

/**
 * Aggregates per-day attendance records into a per-teacher summary: which dates
 * each teacher marked (via `markedById`), and how many distinct dates total.
 * Pure + deterministic — used to render the "Marked by" view and the teacher
 * filter in the drill-down UI.
 */
export function computeTeacherSummary(
  days: Array<TeacherSummaryInput>,
  teacherNames: Record<string, string>
): Array<{ teacherId: string; teacherName: string; markedCount: number; dates: string[] }> {
  const map = new Map<string, { teacherName: string; dates: string[] }>();
  for (const d of days) {
    if (!d.markedById) continue;
    const g = map.get(d.markedById) ?? {
      teacherName: teacherNames[d.markedById] ?? 'Unknown teacher',
      dates: [],
    };
    if (!g.dates.includes(d.date)) g.dates.push(d.date);
    map.set(d.markedById, g);
  }
  return Array.from(map.entries()).map(([teacherId, g]) => ({
    teacherId,
    teacherName: g.teacherName,
    markedCount: g.dates.length,
    dates: g.dates.slice().sort().reverse(),
  }));
}

// ==============================================================================
// Attendance module (enhanced, spec docs/specs/attendance-enhanced.md §4) — pure
// helpers for date-window absence, the monthly register matrix and week-wise
// analytics. All are pure/deterministic so the tester can unit-test them
// without touching a database.
// ==============================================================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM-DD` -> `DD Mon` (e.g. `2026-03-12` -> `12 Mar`). */
export function formatDDMon(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!m || !d || m < 1 || m > 12) return dateKey;
  return `${d} ${MONTHS[m - 1]}`;
}

/** `Date` -> `YYYY-MM-DD` (UTC midnight key, matches how records are stored). */
export const toDateKey = (d: Date): string => d.toISOString().slice(0, 10);

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses an optional `YYYY-MM-DD` date query param into a `Date`.
 * - `null`/empty → `undefined` (no window bound)
 * - invalid format or non-existent calendar date → throws
 *   `ApiError(400, VALIDATION_ERROR)` (same contract as report/analytics routes)
 * - `endOfDay=true` returns end-of-day UTC so a `lte` filter covers the whole day;
 *   `false` returns midnight so a `gte` filter starts at the very beginning.
 */
export function parseOptionalDate(
  raw: string | null,
  field: string,
  endOfDay: boolean
): Date | undefined {
  if (raw === null || raw === '') return undefined;
  if (!isoDatePattern.test(raw) || Number.isNaN(new Date(raw + 'T00:00:00.000Z').getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a valid date YYYY-MM-DD`);
  }
  return new Date(raw + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
}

export interface AbsenceRecordInput {
  studentId: string;
  status: string;
  date: string | Date;
}

/**
 * Groups ABSENT dates per student, ascending, formatted `DD Mon`.
 * Only records that are ABSENT are considered; the caller is responsible for
 * scoping the input to the window/range being reported.
 */
export function computeAbsentDatesByStudent(
  records: AbsenceRecordInput[]
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const r of records) {
    if (r.status !== 'ABSENT') continue;
    const key = typeof r.date === 'string' ? r.date : toDateKey(r.date);
    const arr = groups.get(r.studentId) ?? [];
    arr.push(key);
    groups.set(r.studentId, arr);
  }
  const out = new Map<string, string[]>();
  for (const [studentId, keys] of Array.from(groups.entries())) {
    keys.sort();
    out.set(studentId, keys.map(formatDDMon));
  }
  return out;
}

// ---- Monthly register ------------------------------------------------

export interface RegisterRecordInput {
  studentId: string;
  status: string;
  date: string; // YYYY-MM-DD
}

export interface RegisterRow {
  studentId: string;
  rollNo: string;
  name: string;
  cells: Array<'P' | 'A' | null>;
  present: number;
  total: number;
  percentage: number | null;
  absentDates: string[];
}

export interface RegisterStudentInfo {
  rollNo: string;
  name: string;
}

/**
 * Builds the monthly register matrix from raw (already tenant/month-scoped)
 * records. The header is the ascending list of dates in the month that have at
 * least one record; each student row has one cell per header date (`P`/`A` or
 * `null` when the student has no record that day). Weekend/percentage are
 * computed over recorded days only.
 */
export function buildRegisterMatrix(
  records: RegisterRecordInput[],
  students: Record<string, RegisterStudentInfo>
): { header: string[]; rows: RegisterRow[] } {
  const dateKeys = Array.from(new Set(records.map((r) => r.date))).sort();
  const header = dateKeys.map(formatDDMon);
  const colIndex = new Map(dateKeys.map((d, i) => [d, i]));

  const byStudent = new Map<string, Array<{ col: number; status: string }>>();
  for (const r of records) {
    const col = colIndex.get(r.date)!;
    const arr = byStudent.get(r.studentId) ?? [];
    arr.push({ col, status: r.status });
    byStudent.set(r.studentId, arr);
  }

  const rows: RegisterRow[] = [];
  for (const [studentId, cells] of Array.from(byStudent.entries())) {
    const cellArr: Array<'P' | 'A' | null> = new Array(dateKeys.length).fill(null);
    let present = 0;
    let total = 0;
    const absentKeys: string[] = [];
    for (const c of cells) {
      cellArr[c.col] = c.status === 'PRESENT' ? 'P' : 'A';
      total++;
      if (c.status === 'PRESENT') present++;
      else absentKeys.push(dateKeys[c.col]);
    }
    absentKeys.sort();
    const info = students[studentId];
    rows.push({
      studentId,
      rollNo: info?.rollNo ?? '',
      name: info?.name ?? '',
      cells: cellArr,
      present,
      total,
      percentage: computeAttendancePercentage(present, total),
      absentDates: absentKeys.map(formatDDMon),
    });
  }

  rows.sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  return { header, rows };
}

// ---- Week-wise analytics ---------------------------------------------

export interface WeeklyStat {
  weekLabel: string;
  present: number;
  absent: number;
}

/** ISO-8601 week number (week starts Monday) for a `YYYY-MM-DD` date. */
function isoWeekOf(dateKey: string): { year: number; week: number } {
  const d = new Date(dateKey + 'T00:00:00.000Z');
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // move to Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return { year: d.getUTCFullYear(), week };
}

/**
 * Groups attendance records into ISO-week buckets (`Wk NN`), summing present and
 * absent per week, ordered chronologically. Records must already be scoped to
 * the requested window by the caller.
 */
export function computeWeeklyStats(
  records: Array<{ date: string; status: string }>
): WeeklyStat[] {
  const map = new Map<string, { year: number; week: number; present: number; absent: number }>();
  for (const r of records) {
    const { year, week } = isoWeekOf(r.date);
    const key = `${year}-${week}`;
    const g = map.get(key) ?? { year, week, present: 0, absent: 0 };
    if (r.status === 'PRESENT') g.present++;
    else g.absent++;
    map.set(key, g);
  }
  const entries = Array.from(map.values()).sort(
    (a, b) => a.year * 100 + a.week - (b.year * 100 + b.week)
  );
  return entries.map((e) => ({
    weekLabel: `Wk ${String(e.week).padStart(2, '0')}`,
    present: e.present,
    absent: e.absent,
  }));
}

export interface AnalyticsTeacher {
  teacherId: string;
  teacherName: string;
  markedCount: number;
  dates: string[];
}

/**
 * Per-teacher marking summary for analytics: markedCount = distinct dates marked,
 * dates = ascending `DD Mon` labels. Mirrors computeTeacherSummary but formats
 * the dates ascending (spec §4 analytics).
 */
export function buildAnalyticsTeachers(
  records: Array<{ date: string; markedById: string | null }>,
  teacherNames: Record<string, string>
): AnalyticsTeacher[] {
  const map = new Map<string, { teacherName: string; dates: string[] }>();
  for (const r of records) {
    if (!r.markedById) continue;
    const g = map.get(r.markedById) ?? {
      teacherName: teacherNames[r.markedById] ?? 'Unknown teacher',
      dates: [],
    };
    if (!g.dates.includes(r.date)) g.dates.push(r.date);
    map.set(r.markedById, g);
  }
  return Array.from(map.entries()).map(([teacherId, g]) => ({
    teacherId,
    teacherName: g.teacherName,
    markedCount: g.dates.length,
    dates: g.dates.slice().sort().map(formatDDMon),
  }));
}
