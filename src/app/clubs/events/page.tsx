"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, CalendarDays, XCircle } from "lucide-react";
import { PageTitle } from "@/components/clubs/ClubsShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageClubs,
    Club,
    ClubEvent,
    ClubsApiError,
    createEvent,
    fetchClubs,
    fetchEvents,
    updateEvent,
} from "@/lib/clubs";

const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const EVENT_TONE: Record<string, string> = {
    UPCOMING: "bg-indigo-50 text-indigo-700 border-indigo-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function EventsBoardPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageClubs(currentUser);

    const [clubs, setClubs] = useState<Club[]>([]);
    const [events, setEvents] = useState<ClubEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({ clubId: "", title: "", date: "", venue: "" });
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [c, e] = await Promise.all([fetchClubs(), fetchEvents()]);
            setClubs(c.clubs);
            setEvents(e.events);
        } catch (err) {
            setLoadError(err instanceof ClubsApiError ? err.message : "Unable to load events.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async () => {
        setFieldError(null);
        setSubmitError(null);
        if (!form.clubId) {
            setFieldError("Select a club.");
            return;
        }
        if (!form.title.trim()) {
            setFieldError("Event title is required.");
            return;
        }
        if (!form.date) {
            setFieldError("Event date is required.");
            return;
        }
        setBusy(true);
        try {
            const res = await createEvent({
                clubId: form.clubId,
                title: form.title.trim(),
                date: form.date,
                venue: form.venue.trim() || null,
            });
            setEvents((prev) => [res.event, ...prev]);
            setFormOpen(false);
            setForm({ clubId: "", title: "", date: "", venue: "" });
        } catch (e) {
            setSubmitError(e instanceof ClubsApiError ? e.message : "Unable to create event.");
        } finally {
            setBusy(false);
        }
    };

    const cancel = async (ev: ClubEvent) => {
        setSubmitError(null);
        setBusy(true);
        try {
            const res = await updateEvent(ev.id, { status: "CANCELLED" });
            setEvents((prev) => prev.map((x) => (x.id === ev.id ? res.event : x)));
        } catch (e) {
            setSubmitError(e instanceof ClubsApiError ? e.message : "Unable to cancel event.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Events board"
                subtitle="Club events across campus — future events first."
                action={
                    canManage ? (
                        <button
                            type="button"
                            onClick={() => {
                                setFormOpen((v) => !v);
                                setSubmitError(null);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> New event
                        </button>
                    ) : undefined
                }
            />

            {formOpen && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-bold text-slate-900 mb-4">Create an event</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Club
                            </label>
                            <select
                                value={form.clubId}
                                onChange={(e) => setForm((f) => ({ ...f, clubId: e.target.value }))}
                                className={inputCls}
                            >
                                <option value="">Select a club…</option>
                                {clubs.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Date
                            </label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                                className={inputCls}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Title
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="Event title"
                                className={inputCls}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Venue
                            </label>
                            <input
                                type="text"
                                value={form.venue}
                                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                                placeholder="Venue (optional)"
                                className={inputCls}
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
                            {busy ? "Creating…" : "Create event"}
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
            ) : events.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No events scheduled"
                        description="Club events will appear here once created."
                    />
                </div>
            ) : (
                <div className="space-y-3">
                    {events.map((ev) => (
                        <div
                            key={ev.id}
                            className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4"
                        >
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <CalendarDays className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-900 truncate">{ev.title}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {ev.clubName} · {new Date(ev.date).toLocaleDateString()} ·{" "}
                                        {ev.venue ?? "Venue TBD"}
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-600 mt-1.5">
                                        {ev.rsvpCount} RSVP
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${EVENT_TONE[ev.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
                                >
                                    {ev.status}
                                </span>
                                {canManage && ev.status === "UPCOMING" && (
                                    <button
                                        type="button"
                                        onClick={() => cancel(ev)}
                                        disabled={busy}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-60 cursor-pointer"
                                    >
                                        <XCircle className="h-3.5 w-3.5" /> Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
