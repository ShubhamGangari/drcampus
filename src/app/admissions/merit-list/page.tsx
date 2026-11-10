"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Loader2, CheckCircle2, Send, ListOrdered } from "lucide-react";
import { PageTitle } from "@/components/admissions/AdmissionsShell";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { EmptyState, ErrorState } from "@/components/admissions/States";
import { Toast } from "@/components/admissions/Toast";
import {
  AdmissionCycle,
  ApplicationRecord,
  MeritResult,
  fetchApplications,
  fetchCycles,
  generateMeritList,
  publishMeritList,
  AdmissionsApiError,
} from "@/lib/admissions";
import { PROGRAMS } from "@/data/mockData";

export default function MeritListPage() {
  const [cycles, setCycles] = useState<AdmissionCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [cyclesError, setCyclesError] = useState<string | null>(null);

  const [cycleId, setCycleId] = useState("");
  const [programId, setProgramId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ cycleId?: string; programId?: string }>({});

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MeritResult | null>(null);

  const [preview, setPreview] = useState<ApplicationRecord[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [published, setPublished] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadPreview = useCallback(async (cid: string, pid: string) => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const rankedRes = await fetchApplications({ cycleId: cid, programId: pid });
      const ranked = [...rankedRes.applications]
        .filter((app) => app.meritRank != null)
        .sort((a, b) => a.meritRank! - b.meritRank!);
      setPreview(ranked);
    } catch (err) {
      setPreviewError(
        err instanceof AdmissionsApiError ? err.message : "Could not load ranked candidates."
      );
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const loadCycles = useCallback(async () => {
    setCyclesLoading(true);
    setCyclesError(null);
    try {
      const res = await fetchCycles();
      setCycles(res.cycles);
    } catch (e) {
      setCyclesError(e instanceof AdmissionsApiError ? e.message : "Unable to load cycles.");
    } finally {
      setCyclesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  const handleGenerate = async () => {
    const errs: { cycleId?: string; programId?: string } = {};
    if (!cycleId) errs.cycleId = "Select an admission cycle.";
    if (!programId) errs.programId = "Select a program.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setGenerating(true);
    setError(null);
    setPreview(null);
    setPreviewError(null);
    setPublished(false);
    setPublishedAt(null);
    setToast(null);
    try {
      const res = await generateMeritList({ cycleId, programId, formula: "MARKS_PERCENTAGE" });
      setResult(res);
      // Load the ranked candidates for the preview table after generation.
      await loadPreview(cycleId, programId);
    } catch (e) {
      setError(e instanceof AdmissionsApiError ? e.message : "Could not generate merit list.");
      setResult(null);
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!cycleId || !programId) return;
    setPublishing(true);
    setToast(null);
    try {
      const res = await publishMeritList(cycleId, programId);
      setPublished(true);
      setPublishedAt(res.publishedAt);
      setToast({ message: "Merit list published.", type: "success" });
    } catch (err) {
      const message =
        err instanceof AdmissionsApiError && err.status === 404
          ? "No merit list has been generated for this cycle/program yet. Run Generate first."
          : err instanceof AdmissionsApiError
            ? err.message
            : "Could not publish the merit list.";
      setToast({ message, type: "error" });
    } finally {
      setPublishing(false);
    }
  };

  const selectedCycle = cycles.find((c) => c.id === cycleId);
  const selectedProgram = PROGRAMS.find((p) => p.id === programId);

  return (
    <>
      <PageTitle
        title="Merit List Generation"
        subtitle="Generate program-wise merit ranks based on qualifying marks percentage."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generator */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 h-fit">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Generate Merit List</h2>
              <p className="text-xs text-slate-500">Formula: Marks Percentage (descending)</p>
            </div>
          </div>

          {cyclesLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading cycles…
            </div>
          ) : cyclesError ? (
            <ErrorState message={cyclesError} onRetry={loadCycles} />
          ) : cycles.length === 0 ? (
            <EmptyState title="No admission cycles" description="Create a cycle before generating a merit list." />
          ) : (
            <>
              <Field label="Admission Cycle" error={fieldErrors.cycleId}>
                <SelectInput
                  value={cycleId}
                  onChange={(e) => {
                    setCycleId(e.target.value);
                    setFieldErrors((f) => ({ ...f, cycleId: undefined }));
                    setPreview(null);
                    setPublished(false);
                    setPublishedAt(null);
                  }}
                >
                  <option value="">Select cycle…</option>
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.academicYear})
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="Program" error={fieldErrors.programId}>
                <SelectInput
                  value={programId}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    setFieldErrors((f) => ({ ...f, programId: undefined }));
                    setPreview(null);
                    setPublished(false);
                    setPublishedAt(null);
                  }}
                >
                  <option value="">Select program…</option>
                  {PROGRAMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              {error && (
                <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5" role="alert">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4" />
                    Generate Merit List
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Result */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Generation Result</h2>
            {published && (
              <span
                title={publishedAt ? new Date(publishedAt).toLocaleString("en-IN") : undefined}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Published
                {publishedAt ? ` · ${new Date(publishedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}` : null}
              </span>
            )}
          </div>

          {result ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{result.totalRanked}</p>
                  <p className="text-xs font-medium text-emerald-600">applicants ranked</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs text-slate-500">Program</span>
                  <span className="text-xs font-semibold text-slate-800 text-right">
                    {selectedProgram?.code ?? result.programId}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs text-slate-500">Cycle</span>
                  <span className="text-xs font-semibold text-slate-800 text-right">
                    {selectedCycle ? `${selectedCycle.title} (${selectedCycle.academicYear})` : cycleId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Generated at</span>
                  <span className="text-xs font-semibold text-slate-800 text-right">
                    {new Date(result.generatedAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Ranked candidate preview */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ListOrdered className="h-3.5 w-3.5 text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ranked Candidates
                  </h3>
                </div>

                {previewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-5">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading ranked candidates…
                  </div>
                ) : previewError ? (
                  <ErrorState message={previewError} onRetry={() => loadPreview(cycleId, programId)} />
                ) : preview && preview.length === 0 ? (
                  <EmptyState
                    title="No ranked candidates"
                    description="No applications in this cycle/program carry a merit rank yet."
                  />
                ) : preview ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Application No</th>
                          <th className="px-4 py-3">Applicant</th>
                          <th className="px-4 py-3">Marks %</th>
                          <th className="px-4 py-3">Merit Rank</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {preview.map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">
                              {app.applicationNo}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {app.applicantName}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{app.marksPercentage}%</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                                #{app.meritRank}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              {/* Publish action */}
              {published ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-700">Merit list published</p>
                    <p className="text-xs text-emerald-600">
                      {publishedAt
                        ? new Date(publishedAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Publish Merit List
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-10 px-6 text-center">
              <Trophy className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-xs text-slate-400">
                Select a cycle and program, then generate the merit list. The ranked count, candidate preview and publish action will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
