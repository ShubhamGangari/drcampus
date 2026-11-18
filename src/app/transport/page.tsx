"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bus, Map, Ticket, Search, Forward, Megaphone, ArrowRight, AlertTriangle } from "lucide-react";
import { PageTitle } from "@/components/transport/TransportShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    TransportApiError,
    fetchPasses,
    fetchRoutes,
    fetchVehicles,
    fetchBroadcasts,
    TransportBroadcast,
} from "@/lib/transport";

function SummaryCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof Bus;
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

export default function TransportDashboardPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";

    const [schoolId, setSchoolId] = useState("");
    const [routes, setRoutes] = useState<Awaited<ReturnType<typeof fetchRoutes>>["routes"]>([]);
    const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof fetchVehicles>>["vehicles"]>([]);
    const [passes, setPasses] = useState<Awaited<ReturnType<typeof fetchPasses>>["passes"]>([]);
    const [broadcasts, setBroadcasts] = useState<TransportBroadcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const scoped = isCentral && schoolId ? schoolId : undefined;
            const [r, v, p, b] = await Promise.all([
                fetchRoutes({ schoolId: scoped }),
                fetchVehicles({ schoolId: scoped }),
                fetchPasses({ schoolId: scoped }),
                fetchBroadcasts({ schoolId: scoped, activeOnly: true }),
            ]);
            setRoutes(r.routes);
            setVehicles(v.vehicles);
            setPasses(p.passes);
            setBroadcasts(b.broadcasts);
        } catch (e) {
            setLoadError(e instanceof TransportApiError ? e.message : "Unable to load transport summary.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const activePasses = passes.filter((p) => p.status === "ACTIVE").length;
    const activeVehicles = vehicles.filter((v) => v.status === "ACTIVE").length;
    const outstandingFee = passes.reduce((sum, p) => sum + (p.status === "PENDING" ? p.fee : 0), 0);

    return (
        <div>
            <PageTitle title="Transport Dashboard" subtitle="Routes, vehicles and bus passes at a glance." />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="transport-school"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All schools</option>
                        <option value="SCHOOL_1">School 1</option>
                        <option value="SCHOOL_2">School 2</option>
                    </select>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    {/* Live Bus Alert Ticker Banner */}
                    {broadcasts.length > 0 && (
                        <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-0.5 shadow-md">
                            <div className="rounded-[14px] bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                                        <AlertTriangle className="h-5 w-5 animate-bounce" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-rose-600 uppercase tracking-wider">
                                                Active Bus Notice ({broadcasts.length})
                                            </span>
                                            <span className="text-[11px] font-semibold text-slate-500">
                                                • {broadcasts[0].routeName}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-900 mt-0.5">
                                            {broadcasts[0].title}
                                            {broadcasts[0].delayMin ? ` (+${broadcasts[0].delayMin}m delay)` : ""}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href="/transport/broadcasts"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl transition-colors shrink-0 self-start sm:self-auto"
                                >
                                    View All Notices <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard icon={Map} label="Routes" value={routes.length} tone="indigo" />
                        <SummaryCard icon={Bus} label="Active vehicles" value={activeVehicles} tone="emerald" />
                        <SummaryCard icon={Ticket} label="Active passes" value={activePasses} tone="amber" />
                        <SummaryCard icon={Megaphone} label="Active notices" value={broadcasts.length} tone="rose" />
                    </div>

                    {routes.length === 0 && (
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
                            <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                            <p className="text-sm font-bold text-slate-700">No routes configured yet</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Add routes in the Routes tab to start building the transport network.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
