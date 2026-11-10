"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageTitle } from "@/components/students/StudentsShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { RequestStatusBadge } from "@/components/students/RequestStatusBadge";
import { ReviewRequestModal } from "@/components/students/ReviewRequestModal";
import { useUniversity } from "@/context/UniversityContext";
import {
  LeaveRequestRecord,
  fetchLeaves,
  reviewLeaveRequest,
  StudentsApiError,
  fullName,
  formatDate,
  formatDateTime,
  isAdminRole,
} from "@/lib/students";

interface ReviewTarget {
  request: LeaveRequestRecord;
  action: "APPROVED" | "REJECTED";
}

export default function LeavesPage() {
  const { currentUser } = useUniversity();
  const isAdmin = isAdminRole(currentUser?.role) || !!currentUser?.isCentral;

  const [rows, setRows] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await fetchLeaves());
    } catch (e) {
      setLoadError(e instanceof StudentsApiError ? e.message : "Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmReview = async (status: "APPROVED" | "REJECTED", remarks?: string) => {
    if (!reviewTarget) return;
    setBusy(true);
    setReviewError(null);
    try {
      await reviewLeaveRequest(reviewTarget.request.id, { status, remarks });
      setReviewTarget(null);
      setToast({
        message: `Leave request ${status === "APPROVED" ? "approved" : "rejected"}.`,
        type: "success",
      });
      load();
    } catch (e) {
      setReviewError(e instanceof StudentsApiError ? e.message : "Unable to update request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle title="Leave Requests" subtitle="Review and action student leave requests." />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No leave requests"
            description="Leave requests submitted by students will appear here for review."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">From</th>
                  <th className="px-5 py-3.5">To</th>
                  <th className="px-5 py-3.5">Reason</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Requested</th>
                  {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors align-top">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">
                        {r.student ? fullName(r.student) : r.studentId}
                      </p>
                      {r.student && (
                        <p className="text-[11px] text-slate-400 font-mono">{r.student.rollNo}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold text-slate-600">{r.type}</span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600">{formatDate(r.fromDate)}</td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600">{formatDate(r.toDate)}</td>
                    <td className="px-5 py-4">
                      <p className="text-xs text-slate-600 max-w-[240px]">{r.reason}</p>
                      {r.remarks && (
                        <p className="text-[11px] text-slate-400 mt-1 italic">Remarks: {r.remarks}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <RequestStatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                      {formatDateTime(r.requestedAt)}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setReviewTarget({ request: r, action: "APPROVED" })}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewTarget({ request: r, action: "REJECTED" })}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReviewRequestModal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget?.action === "APPROVED" ? "Approve Leave Request" : "Reject Leave Request"}
        description={
          reviewTarget
            ? `${reviewTarget.request.type} leave — ${reviewTarget.request.student ? fullName(reviewTarget.request.student) : reviewTarget.request.studentId}`
            : undefined
        }
        busy={busy}
        error={reviewError}
        onConfirm={confirmReview}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
