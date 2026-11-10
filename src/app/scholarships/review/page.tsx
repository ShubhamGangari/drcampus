"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { PageTitle } from "@/components/scholarships/ScholarshipsShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageScholarships,
    fetchApplications,
    ScholarshipsApiError,
    ScholarshipApplication,
    updateApplication,
} from "@/lib/scholarships";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function ReviewPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageScholarships(currentUser);

    const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [remarks, setRemarks] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchApplications();
            setApplications(res.applications);
        } catch (e) {
            setLoadError(e instanceof ScholarshipsApiError ? e.message : "Unable to load applications.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const decide = async (a: ScholarshipApplication, status: "APPROVED" | "REJECTED") => {
        setError(null);
        if (status === "REJECTED" && !remarks[a.id]?.trim()) {
            setError("A remark is required to reject an application.");
            return;
        }
        setBusyId(a.id);
        try {
            const res = await updateApplication(a.id, {
                status,
                remark: remarks[a.id]?.trim() || undefined,
            });
            setApplications((prev) => prev.map((x) => (x.id === a.id ? res.application : x)));
        } catch (e) {
            setError(e instanceof ScholarshipsApiError ? e.message : "Unable to update application.");
        } finally {
            setBusyId(null);
        }
    };

    if (!canManage) {
        return (
            <div>
                <PageTitle title="Admin review" subtitle="Review and award scholarship applications." />
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                    <ShieldAlert className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700">Staff access required</p>
                    <p className="text-xs text-slate-500 mt-1">
                        You need the <span className="font-mono">scholarships.manage</span> permission to review applications.
                    </p>
                </div>
            </div>
        );
    }

    const pending = applications.filter((a) => a.status === "SUBMITTED");
    const decided = applications.filter((a) => a.status !== "SUBMITTED");

    return (
        <div>
            <PageTitle title="Admin review" subtitle="Approve or reject pending scholarship applications." />

            {error && <p className="mb-4 text-xs font-medium text-rose-600">{error}</p>}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-8">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3">Pending ({pending.length})</h3>
                        {pending.length === 0 ? (
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                                <p className="text-xs text-slate-500">No pending applications.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pending.map((a) => (
                                    <div key={a.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{a.schemeName}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    Student {a.studentId} · {new Date(a.createdAt).toLocaleDateString()}
                                                    {a.eligible ? " · Eligible" : " · Not auto-eligible"}
                                                </p>
                                            </div>
                                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                                                {a.status}
                                            </span>
                                        </div>
                                        {a.notes && (
                                            <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                                                {a.notes}
                                            </p>
                                        )}
                                        {a.status === "SUBMITTED" && (
                                            <>
                                                <div className="mt-4">
                                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                                        Remark
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={remarks[a.id] ?? ""}
                                                        onChange={(e) =>
                                                            setRemarks((r) => ({ ...r, [a.id]: e.target.value }))
                                                        }
                                                        placeholder="Required for rejection"
                                                        className={inputCls}
                                                    />
                                                </div>
                                                <div className="mt-3 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => decide(a, "APPROVED")}
                                                        disabled={busyId === a.id}
                                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60 cursor-pointer"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        {busyId === a.id ? "Saving…" : "Approve"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => decide(a, "REJECTED")}
                                                        disabled={busyId === a.id}
                                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors disabled:opacity-60 cursor-pointer"
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        Reject
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3">Awarded ({decided.length})</h3>
                        {decided.length === 0 ? (
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                                <p className="text-xs text-slate-500">No reviewed applications yet.</p>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/80">
                                            <th className="px-5 py-3">Scheme</th>
                                            <th className="px-5 py-3">Student</th>
                                            <th className="px-5 py-3">Amount</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {decided.map((a) => (
                                            <tr key={a.id} className="hover:bg-slate-50/60">
                                                <td className="px-5 py-3.5 font-bold text-slate-900">{a.schemeName}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{a.studentId}</td>
                                                <td className="px-5 py-3.5 text-slate-600">
                                                    ₹{a.awardedAmount.toLocaleString("en-IN")}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span
                                                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${a.status === "APPROVED"
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-rose-50 text-rose-700 border-rose-200"
                                                            }`}
                                                    >
                                                        {a.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
