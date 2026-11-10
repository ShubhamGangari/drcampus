"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, CalendarDays, ArrowRight } from "lucide-react";
import { PageTitle } from "@/components/clubs/ClubsShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Club, ClubEvent, ClubsApiError, fetchClubs, fetchEvents } from "@/lib/clubs";

export default function MyClubsPage() {
    const [clubs, setClubs] = useState<Club[]>([]);
    const [events, setEvents] = useState<ClubEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [c, e] = await Promise.all([fetchClubs(), fetchEvents()]);
            setClubs(c.clubs.filter((x) => x.joined));
            setEvents(e.events);
        } catch (err) {
            setLoadError(err instanceof ClubsApiError ? err.message : "Unable to load your clubs.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const myClubIds = new Set(clubs.map((c) => c.id));
    const myEvents = events.filter((ev) => myClubIds.has(ev.clubId));

    return (
        <div>
            <PageTitle
                title="My clubs"
                subtitle="Clubs you belong to and their upcoming events."
            />

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : clubs.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="You are not in any clubs yet"
                        description="Browse the club board and join clubs that interest you."
                    />
                </div>
            ) : (
                <div className="space-y-5">
                    {clubs.map((c) => (
                        <div key={c.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                        <Users className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900">{c.name}</p>
                                        <p className="text-[11px] text-slate-500">
                                            {c.category} · {c.memberCount} members
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href={`/clubs/${c.id}`}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                                >
                                    View <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>

                            {c.description && <p className="mt-3 text-xs text-slate-500">{c.description}</p>}

                            <div className="mt-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5" /> Events
                                </p>
                                {myEvents.filter((ev) => ev.clubId === c.id).length === 0 ? (
                                    <p className="text-xs text-slate-400">No upcoming events.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {myEvents
                                            .filter((ev) => ev.clubId === c.id)
                                            .map((ev) => (
                                                <li
                                                    key={ev.id}
                                                    className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2"
                                                >
                                                    <span className="text-xs font-semibold text-slate-700">
                                                        {ev.title}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500">
                                                        {new Date(ev.date).toLocaleDateString()} · {ev.rsvpCount} RSVP
                                                    </span>
                                                </li>
                                            ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
