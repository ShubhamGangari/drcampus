"use client";

import { useCallback, useEffect, useState } from "react";
import { Stethoscope, CalendarClock, Activity, FileHeart } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/health/HealthShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { fetchVisits, HealthApiError, HealthVisit } from "@/lib/health";

function SummaryCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof Stethoscope;
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

export default function HealthDashboardPage() {
    const [visits, setVisits] = useState<HealthVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchVisits();
            setVisits(res.visits);
        } catch (e) {
            setLoadError(e instanceof HealthApiError ? e.message : "Unable to load health data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const today = new Date().toDateString();
    const todaysAppointments = visits.filter((v) => new Date(v.date).toDateString() === today).length;
    const openFollowUps = visits.filter((v) => v.status === "FOLLOW_UP_REQUIRED").length;

    return (
        <div>
            <PageTitle title="Medical Centre" subtitle="Health records and visit logs summary." />

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <SummaryCard icon={CalendarClock} label="Today's appointments" value={todaysAppointments} tone="indigo" />
                        <SummaryCard icon={Activity} label="Open follow-ups" value={openFollowUps} tone="amber" />
                        <SummaryCard icon={Stethoscope} label="Total visit logs" value={visits.length} tone="emerald" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Link
                            href="/health/records"
                            className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                        >
                            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                                <FileHeart className="h-5 w-5" />
                            </div>
                            <p className="mt-4 text-sm font-bold text-slate-900">Student health records</p>
                            <p className="mt-1 text-xs text-slate-500">
                                Blood group, allergies, chronic conditions and emergency contacts.
                            </p>
                        </Link>
                        <Link
                            href="/health/visits"
                            className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                        >
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                                <Stethoscope className="h-5 w-5" />
                            </div>
                            <p className="mt-4 text-sm font-bold text-slate-900">Visits & appointments</p>
                            <p className="mt-1 text-xs text-slate-500">
                                Log OPD visits, follow-ups, diagnosis and prescriptions.
                            </p>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
