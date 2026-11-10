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
  TransferRequestRecord,
  fetchTransfers,
  reviewTransferRequest,
  StudentsApiError,
  fullName,
  formatDateTime,
  programCode,
  isAdminRole,
} from "@/lib/students";

export default function TransfersPage() {
  const { currentUser } = useUniversity();
  const isAdmin = isAdminRole(currentUser?.role) || !!currentUser?.isCentral;

  const [rows, setRows] = useState<TransferRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reviewTarget, setReviewTarget] = useState<TransferRequestRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await fetchTransfers());
    } catch (e) {
      setLoadError(e instanceof StudentsApiError ? e.message : "Unable to load transfer requests.");
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
      await reviewTransferRequest(reviewTarget.id, { status, remarks });
      setReviewTarget(null);
      setToast({
        message: `Transfer request ${status === "APPROVED" ? "approved" : "rejected"}.`,
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
      <PageTitle title="Transfer Requests" subtitle="Review and action program-transfer requests." />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No transfer requests"
            description="Transfer requests submitted by students will appear here for review."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">From Program</th>
                  <th className="px-5 py-3.5">To Program</th>
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
                      <span className="text-xs font-bold text-slate-600">{programCode(r.fromProgramId)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold text-indigo-600">{programCode(r.toProgramId)}</span>
                    </td>
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
                            onClick={() => setReviewTarget(r)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewTarget(r)}
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
        title="Review Transfer Request"
        description={reviewTarget ? `${programCode(reviewTarget.fromProgramId)} → ${programCode(reviewTarget.toProgramId)}` : undefined}
        busy={busy}
        error={reviewError}
        onConfirm={confirmReview}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
