"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PageTitle } from "@/components/fees/FeesShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import {
  DueRecord,
  FeesApiError,
  fetchDues,
  formatAmount,
  formatDate,
} from "@/lib/fees";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportDuesCsv(rows: DueRecord[]) {
  const header = ["Student Name", "Roll No", "Total Due (INR)", "Last Payment Date"];
  const lines = rows.map((r) =>
    [r.name, r.rollNo, String(r.totalDue), r.lastPaymentDate ?? ""].map((v) => csvEscape(String(v))).join(",")
  );
  const csv = [header.map(csvEscape).join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fees-dues.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function FeesDuesPage() {
  const { currentUser } = useUniversity();
  const isFinance = currentUser?.role === "FINANCE_OFFICER";

  const [rows, setRows] = useState<DueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await fetchDues(programFilter || undefined));
    } catch (e) {
      setLoadError(e instanceof FeesApiError ? e.message : "Unable to load dues.");
    } finally {
      setLoading(false);
    }
  }, [programFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageTitle
        title="Dues Report"
        subtitle="Outstanding fee balances per student."
        action={
          isFinance && rows.length > 0 ? (
            <button
              type="button"
              onClick={() => exportDuesCsv(rows)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
          aria-label="Filter by program"
        >
          <option value="">All programs</option>
          {PROGRAM_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No dues"
            description="Students with outstanding fee balances will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">Roll No</th>
                  <th className="px-5 py-3.5 text-right">Total due</th>
                  <th className="px-5 py-3.5">Last payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.studentId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{r.name}</td>
                    <td className="px-5 py-3.5 text-slate-600 tabular-nums">{r.rollNo}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center text-sm font-extrabold text-rose-700 tabular-nums">
                        {formatAmount(r.totalDue)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(r.lastPaymentDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
