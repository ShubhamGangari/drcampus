"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { HeartHandshake, Briefcase, Building2, Users, Link2, Clock } from "lucide-react";
import { PageTitle } from "@/components/mentorship/MentorshipShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { useUniversity } from "@/context/UniversityContext";
import { fetchMentors, fetchMyMentorship, fetchAdminMentorship, canViewMentorship } from "@/lib/mentorship";
import type { MentorProfileRow, MentorshipPairingRow, MentorshipStats } from "@/lib/mentorship";

export default function MentorshipHubPage() {
    const { currentUser } = useUniversity();
    const canView = canViewMentorship(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mentors, setMentors] = useState<MentorProfileRow[]>([]);
    const [pairing, setPairing] = useState<MentorshipPairingRow | undefined>(undefined);
    const [stats, setStats] = useState<MentorshipStats | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [m, mine] = await Promise.all([fetchMentors(), fetchMyMentorship()]);
            setMentors(m.mentors);
            setPairing(mine.pairing);
            if (canView) {
                const admin = await fetchAdminMentorship();
                setStats(admin.stats);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load mentorship overview");
        } finally {
            setLoading(false);
        }
    }, [canView]);

    useEffect(() => {
        load();
    }, [load]);

    const available = mentors.filter((m) => m.available);

    return (
        <div>
            <PageTitle title="Mentorship Hub" subtitle="Connect with alumni mentors for career guidance and networking." />

            {loading ? (
                <LoadingState rows={3} />
            ) : error ? (
                <ErrorState message={error} retry={load} />
            ) : (
                <div className="space-y-6">
                    {stats && (
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5 flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900">{stats.mentors}</p>
                                    <p className="text-xs font-medium text-slate-500">Alumni mentors</p>
                                </div>
                            </div>
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5 flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                    <HeartHandshake className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900">{stats.activePairings}</p>
                                    <p className="text-xs font-medium text-slate-500">Active pairings</p>
                                </div>
                            </div>
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5 flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                    <Link2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900">{stats.mentees}</p>
                                    <p className="text-xs font-medium text-slate-500">Mentees</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-sm font-black text-slate-900">Available mentors</h2>
                                <p className="text-[11px] text-slate-500 font-medium">Open to new students</p>
                            </div>
                            <Link
                                href="/mentorship/mentors"
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                            >
                                Browse all
                            </Link>
                        </div>
                        {available.length === 0 ? (
                            <EmptyState
                                title="No mentors available right now"
                                description="Check back soon — mentors open up as new alumni join the network."
                            />
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {available.slice(0, 6).map((mentor) => (
                                    <div key={mentor.id} className="rounded-xl border border-slate-200 p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                <Briefcase className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">{mentor.name}</p>
                                                <p className="text-[11px] text-slate-500">{mentor.field}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                            {mentor.company && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Building2 className="h-3 w-3" /> {mentor.company}
                                                </span>
                                            )}
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {mentor.experience} yrs
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {pairing && (
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                    <HeartHandshake className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-slate-900">Your mentorship</h2>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        Paired with {pairing.mentorName} · {pairing.status}
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/mentorship/my"
                                className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                            >
                                Open My mentorship
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
