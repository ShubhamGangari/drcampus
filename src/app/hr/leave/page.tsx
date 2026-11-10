"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { PageTitle } from "@/components/hr/HrShell";
import { ApplyLeaveModal } from "@/components/hr/ApplyLeaveModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  ApplyLeaveInput,
  applyLeave,
  canApproveLeave,
  fetchLeaveRequests,
  HrApiError,
  isFaculty,
  LeaveRequest,
  LeaveStatus,
  updateLeaveStatus,
} from "@/lib/hr";

const STATUS_META: Record<LeaveStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

function statusBadge(status: LeaveStatus) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function leaveTypeLabel(type: string): string {
  if (!type) return "—";
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HrLeavePage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const canReview = canApproveLeave(currentUser?.role);
  const facultyScoped = isFaculty(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchLeaveRequests({ schoolId: isCentral && schoolId ? schoolId : undefined });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof HrApiError ? e.message : "Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApply = async (input: ApplyLeaveInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await applyLeave(input);
      setModalOpen(false);
      setToast({ message: "Leave request submitted.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof HrApiError ? e.message : "Could not submit leave request.");
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (id: string, status: "APPROVED" | "REJECTED") => {
    setBusy(true);
    setSubmitError(null);
    try {
      await updateLeaveStatus(id, { status });
      setToast({
        message: `Leave ${status === "APPROVED" ? "approved" : "rejected"}.`,
        type: "success",
      });
      await load();
    } catch (e) {
      setToast({ message: e instanceof HrApiError ? e.message : "Could not update request.", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Leave"
        subtitle={facultyScoped ? "Your leave requests" : "Review leave requests across staff"}
        action={
          facultyScoped ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Apply Leave
            </button>
          ) : undefined
        }
      />

      {isCentral && !facultyScoped && (
        <div className="max-w-xs mb-6">
          <SchoolSelect value={schoolId} onChange={setSchoolId} />
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No leave requests"
          description={
            facultyScoped
              ? "You have not applied for leave yet."
              : "No leave requests in this school yet."
          }
          action={
            facultyScoped ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Apply Leave
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold">From</th>
                  <th className="px-4 py-3 font-bold">To</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  {canReview && <th className="px-4 py-3 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{req.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{req.employeeId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(req.fromDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(req.toDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{leaveTypeLabel(req.type)}</td>
                    <td className="px-4 py-3">{statusBadge(req.status)}</td>
                    {canReview && (
                      <td className="px-4 py-3">
                        {req.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleDecision(req.id, "APPROVED")}
                              disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecision(req.id, "REJECTED")}
                              disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-right text-[11px] text-slate-400">—</div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ApplyLeaveModal
        open={modalOpen}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral && facultyScoped}
        onClose={() => setModalOpen(false)}
        onSubmit={handleApply}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
