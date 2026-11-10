"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/transport/TransportShell";
import { RouteFormModal } from "@/components/transport/RouteFormModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageTransport,
    createRoute,
    CreateRouteInput,
    deleteRoute,
    fetchRoutes,
    TransportApiError,
    TransportRoute,
    updateRoute,
    UpdateRouteInput,
} from "@/lib/transport";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function TransportRoutesPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageTransport(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [rows, setRows] = useState<TransportRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<TransportRoute | null>(null);
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const list = await fetchRoutes({ schoolId: isCentral && schoolId ? schoolId : undefined });
            setRows(list.routes);
        } catch (e) {
            setLoadError(e instanceof TransportApiError ? e.message : "Unable to load routes.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async (input: CreateRouteInput | UpdateRouteInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            if (editing) {
                await updateRoute(editing.id, input as UpdateRouteInput);
                setToast({ message: "Route updated.", type: "success" });
            } else {
                await createRoute(input as CreateRouteInput);
                setToast({ message: "Route added.", type: "success" });
            }
            setModalOpen(false);
            setEditing(null);
            load();
        } catch (e) {
            setSubmitError(e instanceof TransportApiError ? e.message : "Unable to save route.");
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (route: TransportRoute) => {
        setBusy(true);
        try {
            await updateRoute(route.id, { active: !route.active });
            setToast({ message: route.active ? "Route deactivated." : "Route activated.", type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof TransportApiError ? e.message : "Unable to update route.", type: "error" });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (route: TransportRoute) => {
        if (!window.confirm(`Delete route "${route.name}"? This cannot be undone.`)) return;
        setBusy(true);
        try {
            await deleteRoute(route.id);
            setToast({ message: "Route deleted.", type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof TransportApiError ? e.message : "Unable to delete route.", type: "error" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Routes & Stops"
                subtitle="The bus route network across the campus."
                action={
                    canManage ? (
                        <button
                            type="button"
                            onClick={() => {
                                setEditing(null);
                                setModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> Add Route
                        </button>
                    ) : undefined
                }
            />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="routes-school"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className={`${inputCls} w-full`}
                    >
                        <option value="">All schools</option>
                        <option value="SCHOOL_1">School 1</option>
                        <option value="SCHOOL_2">School 2</option>
                    </select>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : rows.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No routes yet"
                        description={
                            canManage
                                ? "Add your first route to build the transport network."
                                : "No routes are available yet."
                        }
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Route</th>
                                    <th className="px-5 py-3 font-bold">Stops</th>
                                    <th className="px-5 py-3 font-bold text-right">Distance</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    {canManage && <th className="px-5 py-3 font-bold text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((route) => (
                                    <tr
                                        key={route.id}
                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                                    >
                                        <td className="px-5 py-3.5 font-bold text-slate-900">{route.name}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                                                {route.stops.map((s, i) => (
                                                    <span
                                                        key={s.order}
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"
                                                    >
                                                        <MapPin className="h-3 w-3 text-slate-400" />
                                                        {s.name}
                                                        {s.time ? <span className="text-slate-400">· {s.time}</span> : null}
                                                        {i < route.stops.length - 1 && (
                                                            <span className="text-slate-300 font-bold">→</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right text-slate-600">
                                            {route.distanceKm != null ? `${route.distanceKm} km` : "—"}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${route.active
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-slate-100 text-slate-500 border-slate-200"
                                                    }`}
                                            >
                                                {route.active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditing(route);
                                                            setModalOpen(true);
                                                        }}
                                                        aria-label={`Edit ${route.name}`}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleActive(route)}
                                                        disabled={busy}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                        aria-label={route.active ? "Deactivate route" : "Activate route"}
                                                    >
                                                        {route.active ? "⏸" : "▶"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(route)}
                                                        aria-label={`Delete ${route.name}`}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <RouteFormModal
                open={modalOpen}
                route={editing}
                busy={busy}
                error={submitError}
                schoolRequired={isCentral && !editing}
                onClose={() => {
                    setModalOpen(false);
                    setEditing(null);
                    setSubmitError(null);
                }}
                onSubmit={submit}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
