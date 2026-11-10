"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageTitle } from "@/components/hostel/HostelShell";
import { SubmitComplaintModal } from "@/components/hostel/SubmitComplaintModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SelectInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  canUpdateComplaintStatus,
  ComplaintStatus,
  createComplaint,
  CreateComplaintInput,
  fetchComplaints,
  HostelApiError,
  HostelComplaint,
  updateComplaintStatus,
} from "@/lib/hostel";

const COMPLAINT_STATUS_OPTIONS: ComplaintStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

const STATUS_META: Record<ComplaintStatus, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-amber-50 text-amber-700 border-amber-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-blue-200" },
  RESOLVED: { label: "Resolved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function statusBadge(status: ComplaintStatus) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function complaintTypeLabel(type: string): string {
  if (!type) return "—";
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HostelComplaintsPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const isStudent = currentUser?.role === "STUDENT";
  const canManage = canUpdateComplaintStatus(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<HostelComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const schoolParam = isCentral && schoolId ? schoolId : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchComplaints({ schoolId: schoolParam });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof HostelApiError ? e.message : "Unable to load complaints.");
    } finally {
      setLoading(false);
    }
  }, [schoolParam]);

  useEffect(() => {
    load();
  }, [load]);

  const submitComplaint = async (input: CreateComplaintInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createComplaint(input);
      setToast({ message: "Complaint submitted.", type: "success" });
      setModalOpen(false);
      load();
    } catch (e) {
      setSubmitError(e instanceof HostelApiError ? e.message : "Unable to submit complaint.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (complaint: HostelComplaint, status: ComplaintStatus) => {
    setBusy(true);
    try {
      await updateComplaintStatus(complaint.id, { status });
      setRows((prev) =>
        prev.map((c) => (c.id === complaint.id ? { ...c, status } : c))
      );
      setToast({ message: "Complaint status updated.", type: "success" });
    } catch (e) {
      setToast({
        message: e instanceof HostelApiError ? e.message : "Unable to update status.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Hostel Complaints"
        subtitle={isStudent ? "Your filed complaints." : "Complaints reported by students."}
        action={
          isStudent ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Submit Complaint
            </button>
          ) : undefined
        }
      />

      {isCentral && !isStudent && (
        <div className="mb-5 max-w-xs">
          <SchoolSelect
            value={schoolId}
            onChange={setSchoolId}
            label="School"
            htmlFor="complaints-school"
          />
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <EmptyState
            title={isStudent ? "No complaints filed" : "No complaints yet"}
            description={
              isStudent
                ? "You have not filed any complaints."
                : "Student complaints will appear here."
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                  {!isStudent && <th className="px-5 py-3 font-bold">Student</th>}
                  <th className="px-5 py-3 font-bold">Type</th>
                  <th className="px-5 py-3 font-bold">Description</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Filed On</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((complaint) => (
                  <tr
                    key={complaint.id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors align-top"
                  >
                    {!isStudent && (
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {complaint.studentName}
                      </td>
                    )}
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {complaintTypeLabel(complaint.type)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 max-w-md">{complaint.description}</td>
                    <td className="px-5 py-3.5">
                      {canManage ? (
                        <SelectInput
                          aria-label={`Status for complaint ${complaint.id}`}
                          value={complaint.status}
                          onChange={(e) =>
                            handleStatusChange(complaint, e.target.value as ComplaintStatus)
                          }
                          disabled={busy}
                          className="!w-auto !py-1.5 !text-xs max-w-[150px]"
                        >
                          {COMPLAINT_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_META[s].label}
                            </option>
                          ))}
                        </SelectInput>
                      ) : (
                        statusBadge(complaint.status)
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {formatDate(complaint.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SubmitComplaintModal
        open={modalOpen}
        busy={busy}
        error={submitError}
        onClose={() => setModalOpen(false)}
        onSubmit={submitComplaint}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
