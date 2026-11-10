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
    if (r.status === 'PRESENT') g.present++;
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
