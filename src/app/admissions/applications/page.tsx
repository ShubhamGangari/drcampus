"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search, Download, FileText } from "lucide-react";
import { PageTitle } from "@/components/admissions/AdmissionsShell";
import { Modal } from "@/components/admissions/Modal";
import { Toast } from "@/components/admissions/Toast";
import { StatusBadge } from "@/components/admissions/StatusBadge";
import { Field, TextInput, SelectInput, TextArea } from "@/components/admissions/FormControls";
import { EmptyState, ErrorState, LoadingSkeleton, InlineLoader } from "@/components/admissions/States";
import {
  ApplicationRecord,
  ApplicationStatus,
  ApplicantDocument,
  fetchApplications,
  fetchCycles,
  updateApplicationStatus,
  AdmissionsApiError,
  AdmissionCycle,
} from "@/lib/admissions";
import { PROGRAMS } from "@/data/mockData";

const STATUS_ACTIONS: { value: Exclude<ApplicationStatus, "SUBMITTED">; label: string }[] = [
  { value: "VERIFIED", label: "Verify Documents" },
  { value: "REJECTED", label: "Reject" },
  { value: "SHORTLISTED", label: "Shortlist" },
  { value: "ADMITTED", label: "Admit" },
];

interface StatusTarget {
  application: ApplicationRecord;
  action: Exclude<ApplicationStatus, "SUBMITTED">;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [cycles, setCycles] = useState<AdmissionCycle[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    cycleId: "",
    programId: "",
    status: "" as ApplicationStatus | "",
    search: "",
    meritRank: "" as "" | "RANKED" | "UNRANKED",
  });

  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [docTarget, setDocTarget] = useState<ApplicationRecord | null>(null);

  // Merit-rank filtering is applied client-side on the loaded rows because the
  // frozen GET applications endpoint only accepts cycle/program/status/search.
  const filteredRows = useMemo(() => {
    let rows = applications;
    if (filters.meritRank === "RANKED") rows = rows.filter((a) => a.meritRank != null);
    if (filters.meritRank === "UNRANKED") rows = rows.filter((a) => a.meritRank == null);
    return rows;
  }, [applications, filters.meritRank]);

  const parseDocuments = (app: ApplicationRecord): ApplicantDocument[] => {
    try {
      const parsed = JSON.parse(app.documentsJson || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const docs = docTarget ? parseDocuments(docTarget) : [];

  const exportCsv = () => {
    const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const cols = [
      "Application No",
      "Applicant Name",
      "Email",
      "Phone",
      "Program",
      "Category",
      "Marks %",
      "Merit Rank",
      "Status",
    ];
    const rows = filteredRows.map((app) => [
      app.applicationNo,
      app.applicantName,
      app.email,
      app.phone,
      PROGRAMS.find((p) => p.id === app.programId)?.code ?? app.programId,
      app.category,
      String(app.marksPercentage),
      app.meritRank != null ? String(app.meritRank) : "",
      app.status,
    ]);
    const csv = [cols.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `admissions-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState<string | undefined>(undefined);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadCycles = useCallback(async () => {
    try {
      const res = await fetchCycles();
      setCycles(res.cycles);
    } catch {
      /* filters degrade gracefully */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchApplications({
        cycleId: filters.cycleId || undefined,
        programId: filters.programId || undefined,
        status: filters.status || undefined,
        search: filters.search.trim() || undefined,
      });
      setApplications(res.applications);
    } catch (e) {
      setLoadError(
        e instanceof AdmissionsApiError ? e.message : "Unable to load applications."
      );
    } finally {
      setLoading(false);
    }
  }, [filters.cycleId, filters.programId, filters.status, filters.search]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    load();
  }, [load]);

  const openStatusModal = (application: ApplicationRecord, action: StatusTarget["action"]) => {
    setStatusTarget({ application, action });
    setRemarks("");
    setRemarksError(undefined);
    setUpdateError(null);
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    if (statusTarget.action === "REJECTED" && !remarks.trim()) {
      setRemarksError("A rejection reason is required.");
      return;
    }
    setUpdating(true);
    setUpdateError(null);
    try {
      await updateApplicationStatus(statusTarget.application.id, {
        status: statusTarget.action,
        remarks: remarks.trim() || undefined,
      });
      setToast(
        `Application ${statusTarget.application.applicationNo} marked as ${statusTarget.action}.`
      );
      setStatusTarget(null);
      await load();
    } catch (e) {
      setUpdateError(e instanceof AdmissionsApiError ? e.message : "Could not update status.");
    } finally {
      setUpdating(false);
    }
  };

  const hasActiveFilters = Boolean(
    filters.cycleId || filters.programId || filters.status || filters.search.trim() || filters.meritRank
  );

  return (
    <>
      <PageTitle
        title="Applications"
        subtitle="Review, filter and manage submitted applications."
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Admission Cycle">
            <SelectInput
              value={filters.cycleId}
              onChange={(e) => setFilters((f) => ({ ...f, cycleId: e.target.value }))}
            >
              <option value="">All cycles</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.academicYear})
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Program">
            <SelectInput
              value={filters.programId}
              onChange={(e) => setFilters((f) => ({ ...f, programId: e.target.value }))}
            >
              <option value="">All programs</option>
              {PROGRAMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Status">
            <SelectInput
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as ApplicationStatus | "" }))
              }
            >
              <option value="">All statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="ADMITTED">Admitted</option>
            </SelectInput>
          </Field>
          <Field label="Search">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <TextInput
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Name, application #, email"
                className="pl-9"
              />
            </div>
          </Field>
          <Field label="Merit Rank">
            <SelectInput
              value={filters.meritRank}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  meritRank: e.target.value as "" | "RANKED" | "UNRANKED",
                }))
              }
            >
              <option value="">All ranks</option>
              <option value="RANKED">Ranked</option>
              <option value="UNRANKED">Unranked</option>
            </SelectInput>
          </Field>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : applications.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No applications match your filters" : "No applications yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing the filters above."
                : "Applications submitted through the public portal will appear here."
            }
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No applications match your filters"
            description="Try adjusting or clearing the filters above."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Application #</th>
                  <th className="px-5 py-3.5">Applicant</th>
                  <th className="px-5 py-3.5">Marks %</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Merit Rank</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRows.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">
                      {app.applicationNo}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{app.applicantName}</p>
                      <p className="text-[11px] text-slate-400">{app.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-slate-800">{app.marksPercentage}%</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600">{app.category}</span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-5 py-4">
                      {app.meritRank != null ? (
                        <span className="inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                          #{app.meritRank}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDocTarget(app)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Docs
                        </button>
                        <SelectInput
                          aria-label={`Change status for ${app.applicationNo}`}
                          value=""
                          onChange={(e) => {
                            const action = e.target.value as StatusTarget["action"];
                            if (action) openStatusModal(app, action);
                          }}
                          className="w-auto inline-block text-xs font-bold px-3 py-1.5 border-slate-300"
                        >
                          <option value="">Change status…</option>
                          {STATUS_ACTIONS.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </SelectInput>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status change modal */}
      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget ? `Mark as ${statusTarget.action}` : "Update status"}
        description={
          statusTarget
            ? `Application ${statusTarget.application.applicationNo} — ${statusTarget.application.applicantName}`
            : undefined
        }
      >
        {statusTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">Current status:</span>
              <StatusBadge status={statusTarget.application.status} />
            </div>
            <Field label="Remarks (optional)" htmlFor="status-remarks" error={remarksError}>
              <TextArea
                id="status-remarks"
                value={remarks}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  if (remarksError) setRemarksError(undefined);
                }}
                placeholder={
                  statusTarget.action === "REJECTED"
                    ? "Required: reason for rejection"
                    : "Add a note about this status change (max 500 chars)"
                }
                maxLength={500}
              />
            </Field>

            {updateError && (
              <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5" role="alert">
                {updateError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                disabled={updating}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatus}
                disabled={updating}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                  statusTarget.action === "REJECTED"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {updating ? <InlineLoader label="Updating…" /> : "Confirm"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Document audit modal */}
      <Modal
        open={Boolean(docTarget)}
        onClose={() => setDocTarget(null)}
        title="Application Documents"
        description={docTarget ? `${docTarget.applicationNo} — ${docTarget.applicantName}` : undefined}
        wide
      >
        {docTarget && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Applicant:</span> {docTarget.applicantName}
              </div>
              <StatusBadge status={docTarget.status} />
            </div>

            {docs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <FileText className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No documents uploaded</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  This application has no attached documents on record.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {docs.map((doc, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-semibold text-slate-800 truncate">{doc.name}</span>
                    </span>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 shrink-0"
                    >
                      Open ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
