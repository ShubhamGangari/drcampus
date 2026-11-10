"use client";

import { useEffect, useState, useCallback } from "react";
import { Briefcase, Building2, Calendar } from "lucide-react";
import { PageTitle } from "@/components/internships/InternshipsShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/admissions/States";
import { fetchMyInternships } from "@/lib/internships";
import type { MyInternship } from "@/lib/internships";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
    APPLIED: { label: "Applied", className: "bg-slate-100 text-slate-700" },
    APPROVED: { label: "Approved", className: "bg-indigo-50 text-indigo-700" },
    ONGOING: { label: "Ongoing", className: "bg-amber-50 text-amber-700" },
    COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
    REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700" },
};

export default function InternshipsMyPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [internships, setInternships] = useState<MyInternship[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchMyInternships();
            setInternships(res.internships);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load your internships");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div>
            <PageTitle title="My Internships" subtitle="Track your internship applications and their status." />

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : error ? (
                <ErrorState message={error} onRetry={load} />
            ) : internships.length === 0 ? (
                <EmptyState
                    title="No internships yet"
                    description="Browse open internship listings and apply to start tracking them here."
                />
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Company</th>
                                    <th className="px-4 py-3">Applied</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {internships.map((item) => {
                                    const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.APPLIED;
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                        <Briefcase className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-semibold text-slate-800">{item.role}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                    {item.companyName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {new Date(item.appliedAt).toLocaleDateString()}
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
