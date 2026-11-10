"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Eye } from "lucide-react";
import { PageTitle } from "@/components/fees/FeesShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { RecordPaymentModal } from "@/components/fees/RecordPaymentModal";
import { ReceiptModal } from "@/components/fees/ReceiptModal";
import { useUniversity } from "@/context/UniversityContext";
import { fullName, StudentSummary, fetchStudents } from "@/lib/students";
import {
  createPayment,
  CreatePaymentInput,
  FeesApiError,
  fetchInvoices,
  fetchPayments,
  formatAmount,
  formatDate,
  Invoice,
  PaymentRecord,
} from "@/lib/fees";

export default function FeesPaymentsPage() {
  const { currentUser } = useUniversity();
  const isFinance = currentUser?.role === "FINANCE_OFFICER";
  const isCentral = currentUser?.schoolId === "ALL";

  const [rows, setRows] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [recordOpen, setRecordOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<PaymentRecord | null>(null);

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [payments, invoiceRows] = await Promise.all([
        fetchPayments(),
        fetchInvoices(),
      ]);
      setRows(payments);
      setInvoices(invoiceRows);
      if (isFinance) {
        const studentRows = await fetchStudents();
        setStudents(studentRows);
      } else {
        setStudents([]);
      }
    } catch (e) {
      setLoadError(e instanceof FeesApiError ? e.message : "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  }, [isFinance]);

  useEffect(() => {
    load();
  }, [load]);

  const studentMap = useMemo(() => {
    const map = new Map<string, StudentSummary>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const studentLabel = (p: PaymentRecord) => {
    if (!isFinance) return currentUser?.name || "—";
    const s = studentMap.get(p.studentId);
    return s ? fullName(s) : "—";
  };

  const submitPayment = async (input: CreatePaymentInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await createPayment(input);
      setRecordOpen(false);
      setToast({ message: `Payment recorded. Receipt ${res.receiptNo}.`, type: "success" });
      load();
    } catch (e) {
      setSubmitError(e instanceof FeesApiError ? e.message : "Unable to record payment.");
    } finally {
      setBusy(false);
    }
  };

  const payableInvoices = useMemo(() => invoices.filter((i) => i.status !== "PAID"), [invoices]);

  return (
    <div>
      <PageTitle
        title="Payments"
        subtitle="All payments recorded against invoices."
        action={
          isFinance ? (
            <button
              type="button"
              onClick={() => setRecordOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Record payment
            </button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No payments"
            description="Payments recorded against invoices will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Payment ID</th>
                  <th className="px-5 py-3.5">Invoice</th>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5">Mode</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 tabular-nums">{p.id}</td>
                    <td className="px-5 py-3.5 text-slate-600 tabular-nums">{p.invoiceNo ?? "—"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{studentLabel(p)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                      {formatAmount(p.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{p.mode}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(p.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setReceiptTarget(p)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordPaymentModal
        open={recordOpen}
        invoices={payableInvoices}
        defaultInvoice={null}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral}
        onClose={() => {
          setRecordOpen(false);
          setSubmitError(null);
        }}
        onSubmit={submitPayment}
      />

      <ReceiptModal
        open={!!receiptTarget}
        payment={receiptTarget}
        studentLabel={receiptTarget ? studentLabel(receiptTarget) : undefined}
        onClose={() => setReceiptTarget(null)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
