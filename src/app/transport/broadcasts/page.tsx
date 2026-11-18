"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Megaphone,
    Clock,
    AlertTriangle,
    Wrench,
    Navigation,
    Calendar,
    Bus,
    CheckCircle2,
    Trash2,
    Plus,
    Filter,
    ShieldAlert,
    Radio,
    Sparkles,
} from "lucide-react";
import { PageTitle } from "@/components/transport/TransportShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Toast } from "@/components/admissions/Toast";
import { BroadcastModal } from "@/components/transport/BroadcastModal";
import { useUniversity } from "@/context/UniversityContext";
import {
    BroadcastType,
    TransportBroadcast,
    TransportRoute,
    deleteBroadcast,
    fetchBroadcasts,
    fetchRoutes,
    updateBroadcast,
    canManageTransport,
} from "@/lib/transport";

function typeConfig(type: BroadcastType): {
    label: string;
    badgeCls: string;
    borderCls: string;
    icon: typeof AlertTriangle;
} {
    switch (type) {
        case "DELAY":
            return {
                label: "Bus Delay",
                badgeCls: "bg-amber-50 text-amber-700 border-amber-200",
                borderCls: "border-l-amber-500",
                icon: Clock,
            };
        case "BREAKDOWN":
            return {
                label: "Breakdown / Repair",
                badgeCls: "bg-rose-50 text-rose-700 border-rose-200",
                borderCls: "border-l-rose-500",
                icon: Wrench,
            };
        case "ROUTE_CHANGE":
            return {
                label: "Route Diverted",
                badgeCls: "bg-blue-50 text-blue-700 border-blue-200",
                borderCls: "border-l-blue-500",
                icon: Navigation,
            };
        case "TIMING_UPDATE":
            return {
                label: "Timing Revised",
                badgeCls: "bg-purple-50 text-purple-700 border-purple-200",
                borderCls: "border-l-purple-500",
                icon: Calendar,
            };
        case "EMERGENCY":
            return {
                label: "Urgent Alert",
                badgeCls: "bg-red-50 text-red-800 border-red-300 animate-pulse",
                borderCls: "border-l-red-600",
                icon: ShieldAlert,
            };
    }
}

function formatRelativeTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function RouteBroadcastsPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageTransport(currentUser);

    const [schoolId, setSchoolId] = useState("");
    const [routeIdFilter, setRouteIdFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("ALL");
    const [activeOnly, setActiveOnly] = useState(false);

    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [broadcasts, setBroadcasts] = useState<TransportBroadcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Fetch routes and broadcasts
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [routesRes, bcastRes] = await Promise.all([
                fetchRoutes({ schoolId: schoolId || undefined }),
                fetchBroadcasts({
                    schoolId: schoolId || undefined,
                    routeId: routeIdFilter || undefined,
                    activeOnly,
                }),
            ]);
            setRoutes(routesRes.routes);
            setBroadcasts(bcastRes.broadcasts);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to load broadcasts";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [schoolId, routeIdFilter, activeOnly]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleToggleActive = async (b: TransportBroadcast) => {
        try {
            await updateBroadcast(b.id, { active: !b.active });
            setToast({
                message: b.active ? "Alert marked as resolved." : "Alert reactivated.",
                type: "success",
            });
            loadData();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to update alert";
            setToast({ message: msg, type: "error" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this broadcast?")) return;
        try {
            await deleteBroadcast(id);
            setToast({ message: "Broadcast deleted.", type: "success" });
            loadData();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to delete broadcast";
            setToast({ message: msg, type: "error" });
        }
    };

    const filteredBroadcasts = broadcasts.filter((b) => {
        if (typeFilter !== "ALL" && b.type !== typeFilter) return false;
        return true;
    });

    const activeCount = broadcasts.filter((b) => b.active).length;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {modalOpen && (
                <BroadcastModal
                    routes={routes}
                    schoolId={schoolId}
                    onClose={() => setModalOpen(false)}
                    onCreated={loadData}
                />
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Radio className="h-3 w-3 animate-ping text-amber-600" /> Live Feed
                        </span>
                        {activeCount > 0 ? (
                            <span className="text-[11px] font-bold text-rose-600">
                                {activeCount} active bus alert{activeCount > 1 ? "s" : ""}
                            </span>
                        ) : (
                            <span className="text-[11px] font-bold text-emerald-600">
                                All routes running on time
                            </span>
                        )}
                    </div>
                    <PageTitle
                        title="Route Broadcasts & Bus Alerts"
                        subtitle="Instant delay, breakdown and timing notices. Direct WhatsApp replacement for all route passengers."
                    />
                </div>

                {canManage && (
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-black shadow-sm transition-all shrink-0 cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        Send Bus Broadcast
                    </button>
                )}
            </div>

            {/* Filter Bar */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Filter className="h-3.5 w-3.5" /> Filters:
                    </div>

                    {/* Route Filter */}
                    <select
                        value={routeIdFilter}
                        onChange={(e) => setRouteIdFilter(e.target.value)}
                        className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                        <option value="">All Bus Routes</option>
                        {routes.map((r) => (
                            <option key={r.id} value={r.id}>
                                Route: {r.name}
                            </option>
                        ))}
                    </select>

                    {/* Category Filter */}
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                        <option value="ALL">All Alert Types</option>
                        <option value="DELAY">⏱️ Delays Only</option>
                        <option value="BREAKDOWN">🛠️ Breakdowns</option>
                        <option value="ROUTE_CHANGE">🚧 Route Diversions</option>
                        <option value="TIMING_UPDATE">⏰ Timing Revisions</option>
                        <option value="EMERGENCY">🚨 Emergencies</option>
                    </select>
                </div>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={activeOnly}
                            onChange={(e) => setActiveOnly(e.target.checked)}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                        />
                        Active only
                    </label>

                    <button
                        type="button"
                        onClick={loadData}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                        Refresh Feed
                    </button>
                </div>
            </div>

            {/* Feed State */}
            {loading ? (
                <LoadingSkeleton count={3} />
            ) : error ? (
                <ErrorState message={error} onRetry={loadData} />
            ) : filteredBroadcasts.length === 0 ? (
                <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-12 text-center max-w-lg mx-auto">
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-black text-slate-900">All Routes On Schedule</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        No active bus delay or breakdown broadcasts reported. All university vehicles are running normally.
                    </p>
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-amber-600 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" /> Post First Broadcast
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredBroadcasts.map((b) => {
                        const cfg = typeConfig(b.type);
                        const Icon = cfg.icon;

                        return (
                            <div
                                key={b.id}
                                className={`rounded-2xl bg-white border border-slate-200 shadow-sm p-5 transition-all border-l-4 ${cfg.borderCls} ${
                                    !b.active ? "opacity-60 bg-slate-50/50" : ""
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex items-start gap-3.5">
                                        <div
                                            className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${cfg.badgeCls}`}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                <span
                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${cfg.badgeCls}`}
                                                >
                                                    {cfg.label}
                                                </span>

                                                {b.delayMin && b.delayMin > 0 && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                                        +{b.delayMin} Min Delay
                                                    </span>
                                                )}

                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                                                    🚌 {b.routeName}
                                                </span>

                                                {b.vehicleNo && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                                                        {b.vehicleNo}
                                                    </span>
                                                )}

                                                {!b.active && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-600">
                                                        ✓ RESOLVED
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-sm font-black text-slate-900 leading-snug">
                                                {b.title}
                                            </h3>

                                            <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                                                {b.message}
                                            </p>

                                            <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400 font-medium">
                                                <span>Author: {b.postedBy}</span>
                                                <span>•</span>
                                                <span>{formatRelativeTime(b.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {canManage && (
                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(b)}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                                                    b.active
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                                }`}
                                            >
                                                {b.active ? "Resolve Alert" : "Re-open"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(b.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Delete broadcast"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

