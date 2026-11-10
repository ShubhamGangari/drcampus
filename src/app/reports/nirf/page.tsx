"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, Spinner } from "@/components/admissions/States";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { academicYearChoices } from "@/lib/fees";
import {
  canViewReports,
  exportMetricsCsv,
  fetchNirfReport,
  ReportsApiError,
  ReportMetric,
} from "@/lib/reports";
import { MetricCard } from "@/components/reports/MetricCard";

const AY = academicYearChoices(4);

export default function NirfPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.isCentral || currentUser?.schoolId === "ALL";

  const [year, setYear] = useState(AY[0]);
  const [schoolId, setSchoolId] = useState("");
  const [metrics, setMetrics] = useState<ReportMetric[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (isCentral && !schoolId) {
      setMetrics(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const report = await fetchNirfReport(year, isCentral ? schoolId : undefined);
      setMetrics(report.metrics);
    } catch (e) {
      setMetrics(null);
      setError(e instanceof ReportsApiError ? e.message : "Unable to load the report.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId, year]);

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
          <Field label="Academic Year" htmlFor="nirf-year">
            <SelectInput id="nirf-year" value={year} onChange={(e) => setYear(e.target.value)}>
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
                exportMetricsCsv(`nirf_${year}.csv`, metrics);
                setToast({ message: "NIRF CSV exported.", type: "success" });
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

      {isCentral && !schoolId ? (
        <EmptyState title="Select a school" description="Choose a school to view the NIRF dashboard." />
      ) : loading ? (
        <Spinner label="Loading report…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !metrics || metrics.length === 0 ? (
        <EmptyState title="No data" description="No report data is available for this selection." />
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
