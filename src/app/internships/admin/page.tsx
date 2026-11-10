"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, UserRound, Briefcase, Building2 } from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { PageTitle } from "@/components/internships/InternshipsShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/admissions/States";
import { canManageInternships, fetchAdminInternships, updateInternshipStatus, INTERNSHIP_STATUSES } from "@/lib/internships";
import type { AdminInternship } from "@/lib/internships";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
    APPLIED: { label: "Applied", className: "bg-slate-100 text-slate-700" },
    APPROVED: { label: "Approved", className: "bg-indigo-50 text-indigo-700" },
    ONGOING: { label: "Ongoing", className: "bg-amber-50 text-amber-700" },
    COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
    REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700" },
};

export default function InternshipsAdminPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageInternships(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [internships, setInternships] = useState<AdminInternship[]>([]);

    const [pending, setPending] = useState<Record<string, string>>({});
    const [certNo, setCertNo] = useState<Record<string, string>>({});
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAdminInternships();
            setInternships(res.internships);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load internships");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleUpdateStatus = async (id: string) => {
        setActionError(null);
        const status = pending[id];
        if (!status) return;
        try {
            const certificateNo =
                status === "COMPLETED"
                    ? (certNo[id] ?? "").trim() || null
                    : null;
            await updateInternshipStatus(id, {
                status: status as AdminInternship["status"],
                certificateNo,
            });
            setPending((p) => {
                const next = { ...p };
                delete next[id];
                return next;
            });
            setCertNo((c) => {
                const next = { ...c };
                delete next[id];
                return next;
            });
            await load();
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Failed to update status");
        }
    };

    return (
        <div>
            <PageTitle
                title="Internship Management"
                subtitle="Review and update internship applications."
                action={
                    <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> Staff view
                    </div>
                }
            />

            {actionError && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
                    {actionError}
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : error ? (
                <ErrorState message={error} onRetry={load} />
            ) : internships.length === 0 ? (
                <EmptyState title="No internships" description="There are no internship applications yet." />
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <th className="px-4 py-3">Student</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Company</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Update</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {internships.map((item) => {
                                    const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.APPLIED;
                                    const isCompleting = pending[item.id] === "COMPLETED";
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                        <UserRound className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-semibold text-slate-800">{item.studentName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                                                    {item.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                    {item.companyName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${style.className}`}>
                                                    {style.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {canManage && (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={pending[item.id] ?? ""}
                                                                onChange={(e) => setPending((p) => ({ ...p, [item.id]: e.target.value }))}
                                                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none bg-white"
                                                            >
                                                                <option value="">Set status…</option>
                                                                {INTERNSHIP_STATUSES.filter((s) => s !== item.status).map((s) => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => handleUpdateStatus(item.id)}
                                                                disabled={!pending[item.id] || (isCompleting && !(certNo[item.id] ?? "").trim())}
                                                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                        {isCompleting && (
                                                            <input
                                                                type="text"
                                                                value={certNo[item.id] ?? ""}
                                                                onChange={(e) => setCertNo((c) => ({ ...c, [item.id]: e.target.value }))}
                                                                placeholder="Certificate number (required)"
                                                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none bg-white w-48"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
