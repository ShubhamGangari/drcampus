"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { PageTitle } from "@/components/exams/ExamsShell";
import { ExamPicker } from "@/components/exams/ExamPicker";
import { GradeBadge, ExamStatusBadge } from "@/components/exams/ExamBadges";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton, InlineLoader } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
  ExamsApiError,
  ExamDetail,
  fetchExam,
  fetchResults,
  publishResults,
  unpublishResults,
  ResultRow,
} from "@/lib/exams";

export default function ResultsPage() {
  const { currentUser } = useUniversity();
  const isExamController = currentUser?.role === "EXAM_CONTROLLER";

  const [examId, setExamId] = useState("");
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [detail, list] = await Promise.all([fetchExam(examId), fetchResults(examId)]);
      setExam(detail);
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof ExamsApiError ? e.message : "Unable to load results.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const doPublish = async () => {
    if (!examId) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await publishResults(examId);
      setToast({ message: "Results published.", type: "success" });
      load();
    } catch (e) {
      const message = e instanceof ExamsApiError ? e.message : "Unable to publish results.";
      setSubmitError(message);
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const doUnpublish = async () => {
    if (!examId) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await unpublishResults(examId);
      setToast({ message: "Results unpublished.", type: "success" });
      load();
    } catch (e) {
      const message = e instanceof ExamsApiError ? e.message : "Unable to unpublish results.";
      setSubmitError(message);
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const published = exam?.status === "PUBLISHED";

  return (
    <div>
      <PageTitle
        title="Results"
        subtitle="Publish and review computed results per exam."
        action={
          isExamController && exam && rows.length > 0 ? (
            published ? (
              <button
                type="button"
                onClick={doUnpublish}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {busy ? <InlineLoader label="Working…" /> : (
                  <>
                    <ShieldOff className="h-3.5 w-3.5" />
                    Unpublish
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={doPublish}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {busy ? <InlineLoader label="Publishing…" /> : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Publish
                  </>
                )}
              </button>
            )
          ) : undefined
        }
      />

      <div className="max-w-md mb-5">
        <ExamPicker value={examId} onChange={setExamId} disabled={busy} />
      </div>

      {!examId ? (
        <EmptyState title="Select an exam" description="Choose an exam to view its results." />
      ) : loading ? (
        <LoadingSkeleton rows={6} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No results"
          description="Results are computed after marks have been entered for the exam's schedules."
        />
      ) : (
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50/80">
                    <th className="px-4 py-3 font-bold">Student</th>
                    <th className="px-4 py-3 font-bold">Roll No</th>
                    <th className="px-4 py-3 font-bold text-right">Total Secured</th>
                    <th className="px-4 py-3 font-bold text-right">Total Max</th>
                    <th className="px-4 py-3 font-bold text-right">Percentage</th>
                    <th className="px-4 py-3 font-bold text-center">Grade</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.studentId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-900">{r.name}</td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{r.rollNo}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900">{r.totalSecured}</td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{r.totalMax}</td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{r.percentage.toFixed(2)}%</td>
                      <td className="px-4 py-3.5 text-center">
                        <GradeBadge grade={r.grade} />
                      </td>
                      <td className="px-4 py-3.5">
                        <ExamStatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {submitError && (
            <p className="mt-3 text-xs font-medium text-rose-600" role="alert">
              {submitError}
            </p>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
