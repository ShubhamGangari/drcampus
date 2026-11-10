"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, Spinner } from "@/components/admissions/States";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { academicYearChoices } from "@/lib/fees";
import { PROGRAM_OPTIONS } from "@/lib/students";
import {
  canViewReports,
  exportMetricsCsv,
  fetchNbaReport,
  ReportsApiError,
  ReportMetric,
} from "@/lib/reports";
import { MetricCard } from "@/components/reports/MetricCard";

const AY = academicYearChoices(4);

export default function NbaPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.isCentral || currentUser?.schoolId === "ALL";
  const schoolScopedPrograms =
    !isCentral && currentUser?.schoolId !== "ALL" ? PROGRAM_OPTIONS : PROGRAM_OPTIONS;

  const [year, setYear] = useState(AY[0]);
  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [metrics, setMetrics] = useState<ReportMetric[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!programId) {
      setMetrics(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (isCentral && !schoolId) {
      setMetrics(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const report = await fetchNbaReport(programId, year, isCentral ? schoolId : undefined);
      setMetrics(report.metrics);
    } catch (e) {
      setMetrics(null);
      setError(e instanceof ReportsApiError ? e.message : "Unable to load the program report.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId, programId, year]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canViewReports(currentUser?.role)) {
    return <EmptyState title="No access" description="Only the Registrar and Deans can view accreditation reports." />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Field label="Program" htmlFor="nba-program">
              <SelectInput id="nba-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                <option value="">Select program</option>
                {schoolScopedPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <Field label="Academic Year" htmlFor="nba-year">
            <SelectInput id="nba-year" value={year} onChange={(e) => setYear(e.target.value)}>
              {AY.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </SelectInput>
          </Field>
          {isCentral && (
            <div className="w-56">
              <SchoolSelect value={schoolId} onChange={setSchoolId} label="School" />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (metrics && metrics.length) {
                exportMetricsCsv(`nba_${programId}_${year}.csv`, metrics);
                setToast({ message: "NBA CSV exported.", type: "success" });
              }
            }}
            disabled={!metrics || metrics.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {!programId ? (
        <EmptyState title="Select a program" description="Choose a program to view its NBA metrics." />
      ) : isCentral && !schoolId ? (
        <EmptyState title="Select a school" description="Choose a school to view the program report." />
      ) : loading ? (
        <Spinner label="Loading report…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !metrics || metrics.length === 0 ? (
        <EmptyState title="No data" description="No report data is available for this program and year." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <MetricCard key={m.key} label={m.label} value={m.value} />
          ))}
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
