"use client";

import { AttendanceRecordRow } from "@/lib/attendance";

function PercentageBadge({ value }: { value: number }) {
  const tone =
    value < 75
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-bold tabular-nums ${tone}`}
    >
      {value.toFixed(2)}%
    </span>
  );
}

/**
 * Shared table used by the Attendance Report and Defaulter screens. Both surfaces
 * render the same contract shape (`AttendanceRecordRow[]`).
 *
 * When `onSelectRow` is provided, each row becomes clickable to open the drill-down
 * day view (per-student present/absent by day). A "View" chip appears as a hint.
 *
 * When `onAbsentClick` is provided and a row carries `absentDates`, an "Absent on:"
 * line renders under the percentage and is clickable to open the drill-down modal
 * pre-filtered to the ABSENT status.
 */
export function AttendanceTable({
  rows,
  onSelectRow,
  onAbsentClick,
}: {
  rows: AttendanceRecordRow[];
  onSelectRow?: (row: AttendanceRecordRow) => void;
  onAbsentClick?: (row: AttendanceRecordRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                Roll No
              </th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                Student
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                Total Days
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                Present
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                Percentage
              </th>
              {onSelectRow && (
                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Detail
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.studentId}
                onClick={onSelectRow ? () => onSelectRow(row) : undefined}
                className={
                  onSelectRow
                    ? "hover:bg-slate-50/60 transition-colors cursor-pointer"
                    : "hover:bg-slate-50/60 transition-colors"
                }
              >
                <td className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">
                  {row.rollNo}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-900 whitespace-nowrap">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-600 tabular-nums">
                  {row.totalDays}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-600 tabular-nums">
                  {row.presentDays}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <PercentageBadge value={row.percentage} />
                    {row.absentDates && row.absentDates.length > 0 && (
                      <button
                        type="button"
                        onClick={onAbsentClick ? (e) => {
                          e.stopPropagation();
                          onAbsentClick(row);
                        } : undefined}
                        title={
                          onAbsentClick
                            ? "View absent days"
                            : "Absent dates in the selected window"
                        }
                        aria-label={`Absent on ${row.absentDates.join(", ")}`}
                        className={`text-[10px] font-semibold ${
                          onAbsentClick
                            ? "text-rose-600 underline decoration-rose-300 underline-offset-2 hover:text-rose-800 cursor-pointer"
                            : "text-rose-500"
                        }`}
                      >
                        Absent on: {row.absentDates.join(", ")}
                      </button>
                    )}
                  </div>
                </td>
                {onSelectRow && (
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-indigo-600">
                      View
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
