"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, UserRound, Briefcase, Building2 } from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { PageTitle } from "@/components/placement/PlacementShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/admissions/States";
import { canManagePlacement } from "@/lib/placement";
import {
    fetchAdminApplications,
    updateApplicationStatus,
    fetchPosts,
    PLACEMENT_STATUSES,
} from "@/lib/placement";
import type { PlacementAdminApplication } from "@/lib/placement";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
    APPLIED: { label: "Applied", className: "bg-slate-100 text-slate-700" },
    SHORTLISTED: { label: "Shortlisted", className: "bg-indigo-50 text-indigo-700" },
    OFFERED: { label: "Offered", className: "bg-emerald-50 text-emerald-700" },
    PLACED: { label: "Placed", className: "bg-green-100 text-green-800" },
    REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700" },
};

export default function PlacementAdminPage() {
    const { currentUser } = useUniversity();
    const canManage = canManagePlacement(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [applications, setApplications] = useState<PlacementAdminApplication[]>([]);
    const [posts, setPosts] = useState<{ id: string; title: string }[]>([]);
    const [postFilter, setPostFilter] = useState("");

    const [pending, setPending] = useState<Record<string, string>>({});
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async (postId?: string) => {
        setLoading(true);
        setError(null);
        try {
            const [a, p] = await Promise.all([fetchAdminApplications(postId), fetchPosts()]);
            setApplications(a.applications);
            setPosts(p.posts.map((x) => ({ id: x.id, title: x.title })));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load applications");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleFilter = (postId: string) => {
        setPostFilter(postId);
        load(postId || undefined);
    };

    const handleUpdateStatus = async (id: string) => {
        setActionError(null);
        const status = pending[id];
        if (!status) return;
        try {
            await updateApplicationStatus(id, { status: status as PlacementAdminApplication["status"] });
            setPending((p) => {
                const next = { ...p };
                delete next[id];
                return next;
            });
            await load(postFilter || undefined);
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Failed to update status");
        }
    };

    return (
        <div>
            <PageTitle
                title="Placement Management"
                subtitle="Review and update placement applications."
                action={
                    <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> Staff view
                    </div>
                }
            />

            <div className="mb-5 flex items-center gap-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filter by post</label>
                <select
                    value={postFilter}
                    onChange={(e) => handleFilter(e.target.value)}
                    className="text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
                >
                    <option value="">All posts</option>
                    {posts.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                </select>
            </div>

            {actionError && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
                    {actionError}
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : error ? (
                <ErrorState message={error} onRetry={() => load(postFilter || undefined)} />
            ) : applications.length === 0 ? (
                <EmptyState title="No applications" description="There are no placement applications matching this filter." />
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <th className="px-4 py-3">Student</th>
                                    <th className="px-4 py-3">Post</th>
                                    <th className="px-4 py-3">Company</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Update</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {applications.map((app) => {
                                    const style = STATUS_STYLES[app.status] ?? STATUS_STYLES.APPLIED;
                                    return (
                                        <tr key={app.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                        <UserRound className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-semibold text-slate-800">{app.studentName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                                                    {app.title}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                    {app.companyName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${style.className}`}>
                                                    {style.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {canManage && (
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={pending[app.id] ?? ""}
                                                            onChange={(e) => setPending((p) => ({ ...p, [app.id]: e.target.value }))}
                                                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none bg-white"
                                                        >
                                                            <option value="">Set status…</option>
                                                            {PLACEMENT_STATUSES.filter((s) => s !== app.status).map((s) => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => handleUpdateStatus(app.id)}
                                                            disabled={!pending[app.id]}
                                                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                        >
                                                            Save
                                                        </button>
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
