"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, GraduationCap } from "lucide-react";
import { PageTitle } from "@/components/students/StudentsShell";
import { Toast } from "@/components/admissions/Toast";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { EmptyState, ErrorState, LoadingSkeleton, InlineLoader } from "@/components/admissions/States";
import { StudentStatusBadge } from "@/components/students/StudentStatusBadge";
import { useUniversity } from "@/context/UniversityContext";
import {
  StudentSummary,
  BatchOption,
  fetchEligibleGraduates,
  fetchBatches,
  graduateStudent,
  StudentsApiError,
  fullName,
  PROGRAM_OPTIONS,
  isAdminRole,
} from "@/lib/students";

export default function GraduationsPage() {
  const { currentUser } = useUniversity();
  const isAdmin = isAdminRole(currentUser?.role) || !!currentUser?.isCentral;

  const [batchId, setBatchId] = useState("");
  const [rows, setRows] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    setBatchesError(null);
    try {
      const list = await fetchBatches();
      setBatchOptions(list);
      setBatchId((prev) => (prev && !list.some((b) => b.id === prev) ? "" : prev));
    } catch (e) {
      setBatchesError(e instanceof StudentsApiError ? e.message : "Unable to load batches.");
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const load = useCallback(async () => {
    if (!batchId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      setRows(await fetchEligibleGraduates(batchId));
    } catch (e) {
      setLoadError(e instanceof StudentsApiError ? e.message : "Unable to load eligible students.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  const markGraduated = async (student: StudentSummary) => {
    setBusyId(student.id);
    setActionError(null);
    try {
      await graduateStudent(student.id);
      setToast({ message: `${fullName(student)} marked as graduated.`, type: "success" });
      load();
    } catch (e) {
      setActionError(e instanceof StudentsApiError ? e.message : "Unable to graduate student.");
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const cols = ["Roll No", "Student", "Program", "Status"];
    const data = rows.map((s) => [
      s.rollNo,
      fullName(s),
      PROGRAM_OPTIONS.find((p) => p.id === s.programId)?.code ?? s.programId,
      s.status,
    ]);
    const csv = [cols, ...data].map((r) => r.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `graduating-batch-${batchId}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageTitle
        title="Graduations"
        subtitle="Review eligible students and mark them graduated."
        action={
          isAdmin && rows.length > 0 ? (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export List
            </button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Batch">
            {batchesLoading ? (
              <div className="space-y-1.5">
                <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
                <p className="text-[11px] text-slate-400">Loading batches…</p>
              </div>
            ) : batchesError ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-rose-600">{batchesError}</p>
                <button
                  type="button"
                  onClick={loadBatches}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : (
              <SelectInput value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">Select batch</option>
                {batchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
      </div>

      {actionError && (
        <p
          className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 mb-5"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {!batchId ? (
          batchOptions.length === 0 && !batchesLoading && !batchesError ? (
            <EmptyState
              title="No eligible students"
              description="No batches are available for your school. Please contact your administrator."
            />
          ) : (
            <EmptyState
              title="Select a batch"
              description="Choose a batch to see students eligible for graduation."
            />
          )
        ) : loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No eligible students"
            description="No students in this batch currently meet graduation eligibility."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Roll No</th>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">Program</th>
                  <th className="px-5 py-3.5">Status</th>
                  {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">{s.rollNo}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{fullName(s)}</p>
                      <p className="text-[11px] text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {PROGRAM_OPTIONS.find((p) => p.id === s.programId)?.code ?? s.programId}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StudentStatusBadge status={s.status} />
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => markGraduated(s)}
                          disabled={busyId === s.id}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {busyId === s.id ? (
                            <InlineLoader label="Saving…" />
                          ) : (
                            <>
                              <GraduationCap className="h-3.5 w-3.5" />
                              Mark Graduated
                            </>
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
