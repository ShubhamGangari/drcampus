"use client";

import { useCallback, useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { PageTitle } from "@/components/health/HealthShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { fetchVisits, HealthApiError, HealthVisit } from "@/lib/health";

const STATUS_TONE: Record<string, string> = {
    SCHEDULED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    FOLLOW_UP_REQUIRED: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function MyVisitsPage() {
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
            setLoadError(e instanceof HealthApiError ? e.message : "Unable to load your visits.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div>
            <PageTitle
                title="My visits"
                subtitle="Your visit history at the campus medical centre."
            />

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : visits.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No visits on record"
                        description="Your medical centre visits will appear here once logged."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <ul className="divide-y divide-slate-100">
                        {visits.map((v) => (
                            <li key={v.id} className="px-5 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <UserRound className="h-4 w-4 text-slate-300" />
                                            <p className="text-sm font-bold text-slate-900">
                                                {v.type.replace("_", " ")}
                                            </p>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {new Date(v.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span
                                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_TONE[v.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
                                    >
                                        {v.status.replace("_", " ")}
                                    </span>
                                </div>
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Symptoms
                                        </p>
                                        <p className="text-xs text-slate-700 mt-0.5">{v.symptoms}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Diagnosis
                                        </p>
                                        <p className="text-xs text-slate-700 mt-0.5">{v.diagnosis ?? "—"}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Prescription
                                        </p>
                                        <p className="text-xs text-slate-700 mt-0.5">{v.prescription ?? "—"}</p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
