"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, BadgeCheck } from "lucide-react";
import { PageTitle } from "@/components/library/LibraryShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageLibrary,
    fetchFines,
    LibraryApiError,
    LibraryFine,
    payFine,
} from "@/lib/library";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function LibraryFinesPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageLibrary(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [rows, setRows] = useState<LibraryFine[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const list = await fetchFines({ schoolId: isCentral && schoolId ? schoolId : undefined });
            setRows(list.fines);
        } catch (e) {
            setLoadError(e instanceof LibraryApiError ? e.message : "Unable to load fines.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const markPaid = async (fine: LibraryFine) => {
        setBusyId(fine.id);
        try {
            await payFine(fine.loanId);
            setToast({ message: "Fine marked as paid.", type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof LibraryApiError ? e.message : "Unable to mark fine paid.", type: "error" });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <PageTitle title="Fines" subtitle="Overdue fines across the library." />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="fines-school"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className={`${inputCls} w-full`}
                    >
                        <option value="">All schools</option>
                        <option value="SCHOOL_1">School 1</option>
                        <option value="SCHOOL_2">School 2</option>
                    </select>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : rows.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState title="No fines" description="There are no fines to display." />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Member id</th>
                                    <th className="px-5 py-3 font-bold">Loan</th>
                                    <th className="px-5 py-3 font-bold text-right">Days overdue</th>
                                    <th className="px-5 py-3 font-bold text-right">Amount</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    {canManage && <th className="px-5 py-3 font-bold text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((fine) => (
                                    <tr key={fine.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{fine.memberId}</td>
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{fine.loanId}</td>
                                        <td className="px-5 py-3.5 text-right font-bold text-slate-900">{fine.daysOverdue}</td>
                                        <td className="px-5 py-3.5 text-right">
                                            <span className="inline-flex items-center gap-1.5 font-bold text-rose-600">
                                                <Banknote className="h-3.5 w-3.5" /> ₹{fine.amount.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${fine.status === "PAID"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                                    }`}
                                            >
                                                {fine.status === "PAID" ? "PAID" : "UNPAID"}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end">
                                                    {fine.status !== "PAID" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => markPaid(fine)}
                                                            disabled={busyId === fine.id}
                                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                        >
                                                            <BadgeCheck className="h-3.5 w-3.5" />
                                                            {busyId === fine.id ? "Marking…" : "Mark paid"}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs font-medium text-slate-400">No action</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
