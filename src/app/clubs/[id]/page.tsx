"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, UserPlus, UserMinus, Save, CalendarDays } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/clubs/ClubsShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageClubs,
    CLUB_CATEGORIES,
    Club,
    ClubCategory,
    ClubEvent,
    ClubsApiError,
    fetchClubs,
    fetchEvents,
    memberAction,
    updateClub,
} from "@/lib/clubs";

const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function ClubDetailPage() {
    const params = useParams<{ id: string }>();
    const clubId = params?.id ?? "";
    const { currentUser } = useUniversity();
    const canManage = canManageClubs(currentUser);

    const [club, setClub] = useState<Club | null>(null);
    const [events, setEvents] = useState<ClubEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<{ description: string; category: ClubCategory }>({
        description: "",
        category: "TECHNICAL",
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [c, e] = await Promise.all([fetchClubs(), fetchEvents({ future: true })]);
            const found = c.clubs.find((x) => x.id === clubId);
            setClub(found ?? null);
            setEvents(e.events.filter((x) => x.clubId === clubId));
        } catch (err) {
            setLoadError(err instanceof ClubsApiError ? err.message : "Unable to load club.");
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        load();
    }, [load]);

    const startEdit = () => {
        if (!club) return;
        setDraft({ description: club.description ?? "", category: club.category as ClubCategory });
        setEditing(true);
        setError(null);
    };

    const save = async () => {
        setError(null);
        setBusy(true);
        try {
            const res = await updateClub(clubId, {
                description: draft.description.trim() || null,
                category: draft.category,
            });
            setClub(res.club);
            setEditing(false);
        } catch (e) {
            setError(e instanceof ClubsApiError ? e.message : "Unable to save changes.");
        } finally {
            setBusy(false);
        }
    };

    const joinOrLeave = async (action: "JOIN" | "LEAVE") => {
        setError(null);
        setBusy(true);
        try {
            const res = await memberAction(clubId, { action });
            setClub(res.club);
        } catch (e) {
            setError(e instanceof ClubsApiError ? e.message : "Unable to update membership.");
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <LoadingSkeleton rows={8} />;
    }

    if (loadError) {
        return <ErrorState message={loadError} onRetry={load} />;
    }

    if (!club) {
        return (
            <div>
                <PageTitle title="Club not found" subtitle="This club does not exist." />
                <Link
                    href="/clubs"
                    className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to clubs
                </Link>
            </div>
        );
    }

    return (
        <div>
            <PageTitle
                title={club.name}
                subtitle={`${club.category} · ${club.memberCount} member${club.memberCount === 1 ? "" : "s"}`}
                action={
                    canManage && !editing ? (
                        <button
                            type="button"
                            onClick={startEdit}
                            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors cursor-pointer"
                        >
                            Edit details
                        </button>
                    ) : null
                }
            />

            {error && <p className="mb-4 text-xs font-medium text-rose-600">{error}</p>}

            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                {editing ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Description
                            </label>
                            <textarea
                                value={draft.description}
                                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                                rows={3}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Category
                            </label>
                            <select
                                value={draft.category}
                                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ClubCategory }))}
                                className={inputCls}
                            >
                                {CLUB_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={save}
                                disabled={busy}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                            >
                                <Save className="h-3.5 w-3.5" />
                                {busy ? "Saving…" : "Save"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditing(false)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-slate-700">{club.description ?? "No description yet."}</p>
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => joinOrLeave("JOIN")}
                                disabled={busy}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60 cursor-pointer"
                            >
                                <UserPlus className="h-3.5 w-3.5" /> Join club
                            </button>
                            <button
                                type="button"
                                onClick={() => joinOrLeave("LEAVE")}
                                disabled={busy}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
                            >
                                <UserMinus className="h-3.5 w-3.5" /> Leave
                            </button>
                        </div>
                        {club.coordinatorName && (
                            <p className="mt-4 text-xs text-slate-500">
                                <span className="font-bold text-slate-700">Coordinator: </span>
                                {club.coordinatorName}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-6">
                <h2 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-indigo-600" /> Upcoming events
                </h2>
                {events.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
                        <p className="text-sm font-bold text-slate-700">No upcoming events</p>
                        <p className="text-xs text-slate-500 mt-1">Events for this club will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {events.map((ev) => (
                            <div
                                key={ev.id}
                                className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4"
                            >
                                <div>
                                    <p className="text-sm font-bold text-slate-900">{ev.title}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {new Date(ev.date).toLocaleDateString()} · {ev.venue ?? "Venue TBD"}
                                    </p>
                                </div>
                                <span className="text-[11px] font-bold text-slate-600 bg-slate-50 rounded-full px-2.5 py-1">
                                    {ev.rsvpCount} RSVP
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
