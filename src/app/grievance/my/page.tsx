"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/grievance/GrievanceShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    createTicket,
    CreateTicketInput,
    fetchTickets,
    GRIEVANCE_CATEGORIES,
    GRIEVANCE_PRIORITIES,
    GrievanceApiError,
    GrievanceTicket,
} from "@/lib/grievance";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function MyTicketsPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";

    const [schoolId] = useState("");
    const [tickets, setTickets] = useState<GrievanceTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [category, setCategory] = useState("GENERAL");
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("MEDIUM");
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchTickets({ schoolId: isCentral && schoolId ? schoolId : undefined, mine: true });
            setTickets(res.tickets);
        } catch (e) {
            setLoadError(e instanceof GrievanceApiError ? e.message : "Unable to load your tickets.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async () => {
        setFieldError(null);
        setSubmitError(null);
        if (!subject.trim()) {
            setFieldError("Subject is required.");
            return;
        }
        if (!description.trim()) {
            setFieldError("Description is required.");
            return;
        }
        const input: CreateTicketInput = {
            schoolId: isCentral && schoolId ? schoolId : undefined,
            category,
            subject: subject.trim(),
            description: description.trim(),
            priority: priority as CreateTicketInput["priority"],
        };
        setBusy(true);
        try {
            const res = await createTicket(input);
            setTickets((prev) => [res.ticket, ...prev]);
            setFormOpen(false);
            setSubject("");
            setDescription("");
            setCategory("GENERAL");
            setPriority("MEDIUM");
        } catch (e) {
            setSubmitError(e instanceof GrievanceApiError ? e.message : "Unable to raise ticket.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="My Tickets"
                subtitle="Tickets you raised across the university helpdesk."
                action={
                    <button
                        type="button"
                        onClick={() => setFormOpen((v) => !v)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                        <Plus className="h-4 w-4" /> Raise Ticket
                    </button>
                }
            />

            {formOpen && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-bold text-slate-900 mb-4">Raise a new ticket</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Category
                            </label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} w-full`}>
                                {GRIEVANCE_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Priority
                            </label>
                            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={`${inputCls} w-full`}>
                                {GRIEVANCE_PRIORITIES.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Brief summary of the issue"
                                className={`${inputCls} w-full`}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the grievance in detail…"
                                rows={4}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {(fieldError || submitError) && (
                        <p className="mt-3 text-xs font-medium text-rose-600">{fieldError ?? submitError}</p>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                            {busy ? "Submitting…" : "Submit ticket"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormOpen(false)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : tickets.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No grievances raised yet"
                        description="Raise your first ticket and our helpdesk will get back to you."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <ul className="divide-y divide-slate-100">
                        {tickets.map((t) => (
                            <li key={t.id}>
                                <Link
                                    href={`/grievance/${t.id}`}
                                    className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{t.subject}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            <span className="font-mono">{t.ticketNo}</span> · {t.category} · {t.priority}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span
                                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${t.status === "RESOLVED"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : t.status === "CLOSED"
                                                    ? "bg-slate-100 text-slate-600 border-slate-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                                }`}
                                        >
                                            {t.status.replace("_", " ")}
                                        </span>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
