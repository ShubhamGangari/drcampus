"use client";

import { useCallback, useEffect, useState } from "react";
import { Armchair, Loader2, CheckCircle2, Users } from "lucide-react";
import { PageTitle } from "@/components/admissions/AdmissionsShell";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { Toast } from "@/components/admissions/Toast";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
  ApplicationRecord,
  SeatAllocationResult,
  fetchApplications,
  allocateSeat,
  AdmissionsApiError,
} from "@/lib/admissions";
import { PROGRAMS } from "@/data/mockData";

const QUOTA_OPTIONS = [
  "State Quota (Uttarakhand)",
  "All India / Management",
  "NRI",
];

export default function SeatAllocationPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [applicationId, setApplicationId] = useState("");
  const [programId, setProgramId] = useState("");
  const [quotaCategory, setQuotaCategory] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    applicationId?: string;
    programId?: string;
    quotaCategory?: string;
  }>({});

  const [allocating, setAllocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeatAllocationResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchApplications({});
      setApplications(res.applications);
    } catch (e) {
      setLoadError(e instanceof AdmissionsApiError ? e.message : "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const eligibleApplications = applications.filter((a) => a.status === "SHORTLISTED");
  const allocatedCountByProgram = (pid: string) =>
    applications.filter((a) => a.programId === pid && a.status === "ADMITTED").length;

  const handleAllocate = async () => {
    const errs: typeof fieldErrors = {};
    if (!applicationId) errs.applicationId = "Select an application to allocate.";
    if (!programId) errs.programId = "Select a program.";
    if (!quotaCategory) errs.quotaCategory = "Select a quota category.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAllocating(true);
    setError(null);
    try {
      const res = await allocateSeat({ applicationId, programId, quotaCategory });
      setResult(res);
      setToast(
        res.seatAllocated
          ? `Seat allocated. Provisional roll no: ${res.provisionalRollNo ?? "generated"}.`
          : "Seat allocation did not complete."
      );
      await load();
    } catch (e) {
      setError(e instanceof AdmissionsApiError ? e.message : "Could not allocate seat.");
      setResult(null);
    } finally {
      setAllocating(false);
    }
  };

  const selectedApplication = applications.find((a) => a.id === applicationId);

  return (
    <>
      <PageTitle
        title="Seat Allocation"
        subtitle="Allocate provisional seats to shortlisted applicants against program quota."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Program quota grid */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Users className="h-4.5 w-4.5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Program Quota vs Allocated</h2>
              <p className="text-xs text-slate-500">Allocated = admitted applicants per program</p>
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingSkeleton rows={4} />
            </div>
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={load} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Program</th>
                    <th className="px-5 py-3.5 text-center">Intake</th>
                    <th className="px-5 py-3.5 text-center">Allocated</th>
                    <th className="px-5 py-3.5 text-center">Remaining</th>
                    <th className="px-5 py-3.5 text-center">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {PROGRAMS.map((p) => {
                    const intake = p.currentIntake;
                    const allocated = allocatedCountByProgram(p.id);
                    const remaining = Math.max(intake - allocated, 0);
                    const pct = intake > 0 ? Math.round((allocated / intake) * 100) : 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900 text-xs">{p.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{p.code}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center font-semibold text-slate-800">{intake}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                            <Armchair className="h-3 w-3" />
                            {allocated}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-600">
                          {remaining}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-indigo-500" : "bg-slate-300"
                                  }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 w-9 text-right">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Allocator */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 h-fit">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Armchair className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Allocate Seat</h2>
              <p className="text-xs text-slate-500">Only shortlisted applicants are eligible</p>
            </div>
          </div>

          <Field label="Applicant" error={fieldErrors.applicationId}>
            <SelectInput
              value={applicationId}
              onChange={(e) => {
                setApplicationId(e.target.value);
                setFieldErrors((f) => ({ ...f, applicationId: undefined }));
                setResult(null);
              }}
            >
              <option value="">Select applicant…</option>
              {eligibleApplications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.applicationNo} — {a.applicantName} ({a.marksPercentage}%)
                </option>
              ))}
            </SelectInput>
            {eligibleApplications.length === 0 && !loading && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                No shortlisted applicants available to allocate.
              </p>
            )}
          </Field>

          <Field label="Program" error={fieldErrors.programId}>
            <SelectInput
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setFieldErrors((f) => ({ ...f, programId: undefined }));
                setResult(null);
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

          <Field label="Quota Category" error={fieldErrors.quotaCategory}>
            <SelectInput
              value={quotaCategory}
              onChange={(e) => {
                setQuotaCategory(e.target.value);
                setFieldErrors((f) => ({ ...f, quotaCategory: undefined }));
                setResult(null);
              }}
            >
              <option value="">Select quota…</option>
              {QUOTA_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </SelectInput>
          </Field>

          {selectedApplication && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs">
              <p className="font-bold text-slate-800">{selectedApplication.applicantName}</p>
              <p className="text-slate-500 mt-0.5">{selectedApplication.applicationNo}</p>
              <p className="text-slate-500">Marks: {selectedApplication.marksPercentage}% • {selectedApplication.category}</p>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5" role="alert">
              {error}
            </p>
          )}

          {result?.seatAllocated && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Seat Allocated</p>
                <p className="text-sm font-mono font-bold text-emerald-700 mt-0.5">
                  {result.provisionalRollNo ?? "Roll no generated"}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleAllocate}
            disabled={allocating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {allocating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Allocating…
              </>
            ) : (
              <>
                <Armchair className="h-4 w-4" />
                Allocate Seat
              </>
            )}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
