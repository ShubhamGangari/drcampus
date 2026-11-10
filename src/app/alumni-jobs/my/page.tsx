"use client";

import { useEffect, useState, useCallback } from "react";
import { Briefcase, Building2, Calendar, FileText } from "lucide-react";
import { PageTitle } from "@/components/alumni-jobs/AlumniJobsShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/admissions/States";
import { fetchMyAlumniJobs } from "@/lib/alumni-jobs";
import type { AlumniJob, AlumniJobApplication } from "@/lib/alumni-jobs";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700" },
    APPROVED: { label: "Approved", className: "bg-indigo-50 text-indigo-700" },
    REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700" },
    APPLIED: { label: "Applied", className: "bg-slate-100 text-slate-700" },
};

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.APPLIED;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${style.className}`}>
            {style.label}
        </span>
    );
}

export default function AlumniJobsMyPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jobs, setJobs] = useState<AlumniJob[]>([]);
    const [applications, setApplications] = useState<AlumniJobApplication[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchMyAlumniJobs();
            setJobs(res.jobs);
            setApplications(res.applications);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load your activity");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return (
            <div>
                <PageTitle title="My Activity" subtitle="Jobs you posted and applications you have submitted." />
                <LoadingSkeleton rows={5} />
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <PageTitle title="My Activity" subtitle="Jobs you posted and applications you have submitted." />
                <ErrorState message={error} onRetry={load} />
            </div>
        );
    }

    const noContent = jobs.length === 0 && applications.length === 0;

    return (
        <div>
            <PageTitle title="My Activity" subtitle="Jobs you posted and applications you have submitted." />

            {noContent ? (
                <EmptyState
                    title="No activity yet"
                    description="Post a job opportunity as an alumnus or apply to a board listing to track it here."
                />
            ) : (
                <div className="space-y-8">
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <Briefcase className="h-3.5 w-3.5" />
                            </div>
                            <h2 className="text-sm font-black text-slate-900">Jobs I posted</h2>
                            <span className="text-[11px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-100">
                                {jobs.length}
                            </span>
                        </div>

                        {jobs.length === 0 ? (
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs px-5 py-6 text-center">
                                <p className="text-xs text-slate-500">You have not posted any jobs yet.</p>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                                <th className="px-4 py-3">Title</th>
                                                <th className="px-4 py-3">Company</th>
                                                <th className="px-4 py-3">Posted</th>
                                                <th className="px-4 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {jobs.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3">
                                                        <span className="font-semibold text-slate-800">{item.title}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                            {item.company}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {new Date(item.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={item.status} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                <FileText className="h-3.5 w-3.5" />
                            </div>
                            <h2 className="text-sm font-black text-slate-900">My applications</h2>
                            <span className="text-[11px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-100">
                                {applications.length}
                            </span>
                        </div>

                        {applications.length === 0 ? (
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs px-5 py-6 text-center">
                                <p className="text-xs text-slate-500">You have not applied to any jobs yet.</p>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                                <th className="px-4 py-3">Title</th>
                                                <th className="px-4 py-3">Company</th>
                                                <th className="px-4 py-3">Applied</th>
                                                <th className="px-4 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {applications.map((app) => (
                                                <tr key={app.id} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                                <Briefcase className="h-4 w-4" />
                                                            </div>
                                                            <span className="font-semibold text-slate-800">{app.title}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                            {app.company}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {new Date(app.appliedAt).toLocaleDateString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={app.status} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
