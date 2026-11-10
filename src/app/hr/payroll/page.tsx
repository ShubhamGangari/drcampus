"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { PageTitle } from "@/components/hr/HrShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  approvePayroll,
  canApprovePayroll,
  canGeneratePayroll,
  fetchPayrolls,
  formatAmount,
  formatMonthLabel,
  GeneratePayrollInput,
  generatePayroll,
  HrApiError,
  monthKeyOf,
  PayrollRecord,
  PayrollStatus,
} from "@/lib/hr";

const STATUS_META: Record<PayrollStatus, { label: string; className: string }> = {
  GENERATED: { label: "Generated", className: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function statusBadge(status: PayrollStatus) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function HrPayrollPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const canGenerate = canGeneratePayroll(currentUser?.role);
  const canApprove = canApprovePayroll(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [month, setMonth] = useState(() => monthKeyOf(new Date()));
  const [rows, setRows] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchPayrolls({
        schoolId: isCentral && schoolId ? schoolId : undefined,
        month: month || undefined,
      });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof HrApiError ? e.message : "Unable to load payroll.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setToast(null);
    const input: GeneratePayrollInput = {
      schoolId: isCentral && schoolId ? schoolId : undefined,
      month,
    };
    try {
      await generatePayroll(input);
      setToast({ message: `Payroll generated for ${formatMonthLabel(month)}.`, type: "success" });
      await load();
    } catch (e) {
      setToast({ message: e instanceof HrApiError ? e.message : "Could not generate payroll.", type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id: string) => {
    setGenerating(true);
    try {
      await approvePayroll(id);
      setToast({ message: "Payroll approved and finalized.", type: "success" });
      await load();
    } catch (e) {
      setToast({ message: e instanceof HrApiError ? e.message : "Could not approve payroll.", type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const pending = rows.filter((r) => r.status === "GENERATED").length;

  return (
    <div>
      <PageTitle
        title="Payroll"
        subtitle={month ? `Salary run for ${formatMonthLabel(month)}` : "Monthly salary generation and approval"}
        action={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
            />
            {canGenerate && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wallet className="h-3.5 w-3.5" /> Generate Payroll
              </button>
            )}
          </div>
        }
      />

      {isCentral && (
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
          title="No payroll records"
          description={
            canGenerate
              ? "Generate payroll for the selected month to create salary records."
              : "No payroll records exist for the selected month yet."
          }
          action={
            canGenerate ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wallet className="h-3.5 w-3.5" /> Generate Payroll
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {canApprove && pending > 0 && (
            <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-medium text-amber-800">
              {pending} payroll {pending === 1 ? "record is" : "records are"} pending approval. Approving
              finalizes the salary run.
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-bold">Employee</th>
                    <th className="px-4 py-3 font-bold text-right">Gross</th>
                    <th className="px-4 py-3 font-bold text-right">Deductions</th>
                    <th className="px-4 py-3 font-bold text-right">Net</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    {canApprove && <th className="px-4 py-3 font-bold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{rec.employeeName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{rec.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatAmount(rec.gross)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        −{formatAmount(rec.deductions)}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">
                        {formatAmount(rec.net)}
                      </td>
                      <td className="px-4 py-3">{statusBadge(rec.status)}</td>
                      {canApprove && (
                        <td className="px-4 py-3">
                          {rec.status === "GENERATED" ? (
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => handleApprove(rec.id)}
                                disabled={generating}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Approve
                              </button>
                            </div>
                          ) : (
                            <div className="text-right text-[11px] text-slate-400">Finalized</div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
