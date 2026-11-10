"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Clock, CheckCircle2, AlertOctagon, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/grievance/GrievanceShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    fetchTickets,
    GrievanceApiError,
    GrievanceTicket,
} from "@/lib/grievance";

function SummaryCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof LifeBuoy;
    label: string;
    value: string | number;
    tone: "indigo" | "emerald" | "amber" | "rose";
}) {
    const tones: Record<typeof tone, string> = {
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100",
    };
    return (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex items-start gap-4">
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone]}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{value}</p>
            </div>
        </div>
    );
}

export default function GrievanceDashboardPage() {
    const [tickets, setTickets] = useState<GrievanceTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchTickets({ mine: true });
            setTickets(res.tickets);
        } catch (e) {
            setLoadError(e instanceof GrievanceApiError ? e.message : "Unable to load tickets.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const open = tickets.filter((t) => t.status === "OPEN").length;
    const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
    const resolved = tickets.filter((t) => t.status === "RESOLVED").length;
    const escalated = tickets.filter((t) => t.priority === "URGENT").length;

    return (
        <div>
            <PageTitle title="Helpdesk Dashboard" subtitle="Your tickets and resolution status at a glance." />

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard icon={LifeBuoy} label="Open" value={open} tone="amber" />
                        <SummaryCard icon={Clock} label="In progress" value={inProgress} tone="indigo" />
                        <SummaryCard icon={CheckCircle2} label="Resolved" value={resolved} tone="emerald" />
                        <SummaryCard icon={AlertOctagon} label="Escalated" value={escalated} tone="rose" />
                    </div>

                    {tickets.length === 0 ? (
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                            <LifeBuoy className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                            <p className="text-sm font-bold text-slate-700">No grievances raised yet</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Raise a ticket from My Tickets to get help.
                            </p>
                            <Link
                                href="/grievance/my"
                                className="mt-5 inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                            >
                                Go to My Tickets <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    ) : (
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-900">Recent tickets</span>
                                <Link href="/grievance/my" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                                    View all
                                </Link>
                            </div>
                            <ul className="divide-y divide-slate-100">
                                {tickets.slice(0, 5).map((t) => (
                                    <li key={t.id}>
                                        <Link
                                            href={`/grievance/${t.id}`}
                                            className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors cursor-pointer"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">{t.subject}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    <span className="font-mono">{t.ticketNo}</span> · {t.category}
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                                                {t.status.replace("_", " ")}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
