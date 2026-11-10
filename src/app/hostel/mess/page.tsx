"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageTitle } from "@/components/hostel/HostelShell";
import { AddBillModal } from "@/components/hostel/AddBillModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { formatAmount } from "@/lib/fees";
import {
  canManageMessBills,
  createMessBill,
  CreateMessBillInput,
  fetchMessBills,
  HostelApiError,
  markMessBillPaid,
  MessBill,
} from "@/lib/hostel";

function monthLabel(month: string): string {
  if (!month) return "—";
  const d = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function HostelMessPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const isStudent = currentUser?.role === "STUDENT";
  const canManage = canManageMessBills(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<MessBill[]>([]);
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
      const list = await fetchMessBills({ schoolId: schoolParam });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof HostelApiError ? e.message : "Unable to load mess bills.");
    } finally {
      setLoading(false);
    }
  }, [schoolParam]);

  useEffect(() => {
    load();
  }, [load]);

  const submitBill = async (input: CreateMessBillInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createMessBill(input);
      setToast({ message: "Mess bill added.", type: "success" });
      setModalOpen(false);
      load();
    } catch (e) {
      setSubmitError(e instanceof HostelApiError ? e.message : "Unable to add bill.");
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async (bill: MessBill) => {
    setBusy(true);
    try {
      await markMessBillPaid({ billId: bill.id });
      setRows((prev) => prev.map((b) => (b.id === bill.id ? { ...b, paid: true } : b)));
      setToast({ message: "Bill marked as paid.", type: "success" });
    } catch (e) {
      setToast({
        message: e instanceof HostelApiError ? e.message : "Unable to mark bill paid.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Mess Billing"
        subtitle={isStudent ? "Your mess bills." : "Monthly mess billing per student."}
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Bill
            </button>
          ) : undefined
        }
      />

      {isCentral && (
        <div className="mb-5 max-w-xs">
          <SchoolSelect value={schoolId} onChange={setSchoolId} label="School" htmlFor="mess-school" />
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <EmptyState
            title={isStudent ? "No bills yet" : "No mess bills yet"}
            description={
              isStudent ? "You have no mess bills for your school." : "Add mess bills to track monthly charges."
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-bold">Month</th>
                  {!isStudent && <th className="px-5 py-3 font-bold">Student</th>}
                  <th className="px-5 py-3 font-bold text-right">Amount</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  {canManage && <th className="px-5 py-3 font-bold text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((bill) => (
                  <tr
                    key={bill.id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{monthLabel(bill.month)}</td>
                    {!isStudent && (
                      <td className="px-5 py-3.5 text-slate-600">{bill.studentName}</td>
                    )}
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                      {formatAmount(bill.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      {bill.paid ? (
                        <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          Unpaid
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        {!bill.paid ? (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(bill)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
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

      <AddBillModal
        open={modalOpen}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral}
        onClose={() => setModalOpen(false)}
        onSubmit={submitBill}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
