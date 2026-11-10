"use client";

import { useEffect, useState, useCallback } from "react";
import { Briefcase, Building2, Calendar } from "lucide-react";
import { PageTitle } from "@/components/placement/PlacementShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { fetchMyApplications } from "@/lib/placement";
import type { PlacementApplication } from "@/lib/placement";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
    APPLIED: { label: "Applied", className: "bg-slate-100 text-slate-700" },
    SHORTLISTED: { label: "Shortlisted", className: "bg-indigo-50 text-indigo-700" },
    OFFERED: { label: "Offered", className: "bg-emerald-50 text-emerald-700" },
    PLACED: { label: "Placed", className: "bg-green-100 text-green-800" },
    REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700" },
};

export default function PlacementMyPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [applications, setApplications] = useState<PlacementApplication[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchMyApplications();
            setApplications(res.applications);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load your applications");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div>
            <PageTitle title="My Applications" subtitle="Track your placement applications and their status." />

            {loading ? (
                <LoadingState rows={4} />
            ) : error ? (
                <ErrorState message={error} retry={load} />
            ) : applications.length === 0 ? (
                <EmptyState
                    title="No applications yet"
                    description="Browse placement posts and apply to start tracking your applications here."
                />
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <th className="px-4 py-3">Post</th>
                                    <th className="px-4 py-3">Company</th>
                                    <th className="px-4 py-3">Applied</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {applications.map((app) => {
                                    const style = STATUS_STYLES[app.status] ?? STATUS_STYLES.APPLIED;
                                    return (
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
                                                    {app.companyName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {new Date(app.appliedAt).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${style.className}`}>
                                                    {style.label}
                                                </span>
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
