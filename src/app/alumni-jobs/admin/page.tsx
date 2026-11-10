"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Briefcase, Building2, UserRound, FileText } from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { PageTitle } from "@/components/alumni-jobs/AlumniJobsShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/admissions/States";
import {
    canManageAlumniJobs,
    fetchAdminJobs,
    updateJobStatus,
    JOB_STATUSES,
} from "@/lib/alumni-jobs";
import type { AdminAlumniJob, JobStatus } from "@/lib/alumni-jobs";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700" },
    APPROVED: { label: "Approved", className: "bg-indigo-50 text-indigo-700" },
    REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700" },
};

export default function AlumniJobsAdminPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageAlumniJobs(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jobs, setJobs] = useState<AdminAlumniJob[]>([]);

    const [pending, setPending] = useState<Record<string, string>>({});
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAdminJobs();
            setJobs(res.jobs);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load jobs");
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
            await updateJobStatus(id, { status: status as JobStatus });
            setPending((p) => {
                const next = { ...p };
                delete next[id];
                return next;
            });
            await load();
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Failed to update status");
        }
    };

    if (!canManage) {
        return (
            <div>
                <PageTitle title="Alumni Jobs Management" subtitle="Review and moderate job postings." />
                <div className="rounded-2xl bg-white border border-slate-200 shadow-xs px-6 py-10 text-center">
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
                        <ShieldCheck className="h-6 w-6 text-rose-500" />
                    </div>
                    <h2 className="text-base font-black text-slate-900">Staff access only</h2>
                    <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">
                        Job moderation is restricted to staff with alumni-jobs management permissions.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageTitle
                title="Alumni Jobs Management"
                subtitle="Review and moderate job postings."
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
            ) : jobs.length === 0 ? (
                <EmptyState title="No jobs" description="No job postings have been submitted yet." />
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <th className="px-4 py-3">Title</th>
                                    <th className="px-4 py-3">Company</th>
                                    <th className="px-4 py-3">Posted by</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Applications</th>
                                    <th className="px-4 py-3">Update</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {jobs.map((item) => {
                                    const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.PENDING;
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                        <Briefcase className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-semibold text-slate-800">{item.title}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                    {item.company}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                    <UserRound className="h-3.5 w-3.5 text-slate-400" />
                                                    {item.postedByName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${style.className}`}>
                                                    {style.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                                                    {item.appliedCount}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={pending[item.id] ?? ""}
                                                        onChange={(e) => setPending((p) => ({ ...p, [item.id]: e.target.value }))}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none bg-white"
                                                    >
                                                        <option value="">Set status…</option>
                                                        {JOB_STATUSES.filter((s) => s !== item.status).map((s) => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleUpdateStatus(item.id)}
                                                        disabled={!pending[item.id]}
                                                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
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
