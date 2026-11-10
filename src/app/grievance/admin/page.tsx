"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/grievance/GrievanceShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageGrievance,
    fetchTickets,
    GRIEVANCE_CATEGORIES,
    GRIEVANCE_PRIORITIES,
    GRIEVANCE_STATUSES,
    GrievanceApiError,
    GrievanceTicket,
    updateTicket,
} from "@/lib/grievance";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function GrievanceAdminQueuePage() {
    const { currentUser } = useUniversity();
    const canManage = canManageGrievance(currentUser);

    const [tickets, setTickets] = useState<GrievanceTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");

    const [busyId, setBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchTickets({
                status: statusFilter || undefined,
                category: categoryFilter || undefined,
            });
            let list = res.tickets;
            if (priorityFilter) list = list.filter((t) => t.priority === priorityFilter);
            setTickets(list);
        } catch (e) {
            setLoadError(e instanceof GrievanceApiError ? e.message : "Unable to load tickets.");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, categoryFilter, priorityFilter]);

    useEffect(() => {
        load();
    }, [load]);

    const advance = async (t: GrievanceTicket) => {
        setActionError(null);
        setBusyId(t.id);
        // Simple progression: OPEN → IN_PROGRESS → RESOLVED (resolution not enforced here for demo UX)
        const next =
            t.status === "OPEN" ? "IN_PROGRESS" : t.status === "IN_PROGRESS" ? "RESOLVED" : "CLOSED";
        try {
            const res = await updateTicket(t.id, { status: next as GrievanceTicket["status"] });
            setTickets((prev) => prev.map((x) => (x.id === t.id ? res.ticket : x)));
        } catch (e) {
            setActionError(e instanceof GrievanceApiError ? e.message : "Unable to update ticket.");
        } finally {
            setBusyId(null);
        }
    };

    if (!canManage) {
        return (
            <div>
                <PageTitle title="Admin Queue" subtitle="Triage and resolution queue for the helpdesk." />
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                    <ShieldAlert className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700">Staff access required</p>
                    <p className="text-xs text-slate-500 mt-1">
                        You need the <span className="font-mono">grievance.manage</span> permission to manage the queue.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageTitle title="Admin Queue" subtitle="All helpdesk tickets, filterable by status, category and priority." />

            <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} w-full`}>
                    <option value="">All statuses</option>
                    {GRIEVANCE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {s.replace("_", " ")}
                        </option>
                    ))}
                </select>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${inputCls} w-full`}>
                    <option value="">All categories</option>
                    {GRIEVANCE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                            {c.replace("_", " ")}
                        </option>
                    ))}
                </select>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={`${inputCls} w-full`}>
                    <option value="">All priorities</option>
                    {GRIEVANCE_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>
            </div>

            {actionError && <p className="mb-4 text-xs font-medium text-rose-600">{actionError}</p>}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : tickets.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="Queue is empty"
                        description="No tickets match the current filters. Try clearing the filters."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <ul className="divide-y divide-slate-100">
                        {tickets.map((t) => (
                            <li key={t.id} className="px-5 py-4 flex flex-wrap items-center gap-4">
                                <Link
                                    href={`/grievance/${t.id}`}
                                    className="min-w-0 flex-1 hover:text-indigo-600 cursor-pointer"
                                >
                                    <p className="text-sm font-bold text-slate-900 truncate">{t.subject}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        <span className="font-mono">{t.ticketNo}</span> · {t.category.replace("_", " ")} · {t.priority}
                                    </p>
                                </Link>
                                <span
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${t.status === "RESOLVED"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : t.status === "CLOSED"
                                            ? "bg-slate-100 text-slate-600 border-slate-200"
                                            : t.status === "IN_PROGRESS"
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                : "bg-amber-50 text-amber-700 border-amber-200"
                                        }`}
                                >
                                    {t.status.replace("_", " ")}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => advance(t)}
                                    disabled={busyId === t.id}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {busyId === t.id ? "Saving…" : "Advance"}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
