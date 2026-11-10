"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { PageTitle } from "@/components/hr/HrShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
  fetchMyPayslip,
  formatAmount,
  formatMonthLabel,
  HrApiError,
  monthKeyOf,
  Payslip,
} from "@/lib/hr";

export default function HrPayslipPage() {
  const { currentUser } = useUniversity();
  // Only faculty access this screen (the shell gates other roles out of the module,
  // but this page is faculty-specific).
  const [month, setMonth] = useState(() => monthKeyOf(new Date()));
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchMyPayslip({ month: month || undefined });
      setSlip(data);
    } catch (e) {
      if (e instanceof HrApiError && e.status === 404) {
        setSlip(null);
      } else {
        setLoadError(e instanceof HrApiError ? e.message : "Unable to load your payslip.");
      }
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageTitle
        title="Payslip"
        subtitle={currentUser?.name || "Your monthly payslip"}
        action={
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
          />
        }
      />

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : !slip ? (
        <EmptyState
          title="No payslip for this month"
          description={`No payslip was found for ${formatMonthLabel(month)}. Payslips appear after payroll is generated for the month.`}
        />
      ) : (
        <div className="max-w-2xl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-black text-slate-900">Salary Payslip</h2>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{formatMonthLabel(slip.month)}</p>
              </div>
              <span
                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${
                  slip.status === "APPROVED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {slip.status === "APPROVED" ? "Approved" : "Generated"}
              </span>
            </div>

            <div className="px-6 py-5 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Name</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{slip.employeeName}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5 font-mono">{slip.employeeId}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Month</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{formatMonthLabel(slip.month)}</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Gross salary</span>
                <span className="text-sm font-bold text-slate-900">{formatAmount(slip.gross)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Deductions (tax)</span>
                <span className="text-sm font-medium text-slate-700">
                  −{formatAmount(slip.deductions)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
                <span className="text-sm font-black text-slate-900">Net pay</span>
                <span className="text-base font-black text-indigo-600">{formatAmount(slip.net)}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-4">
            Payslips are tenant-scoped and visible only to you. Contact the registrar with any
            discrepancies.
          </p>
        </div>
      )}
    </div>
  );
}
