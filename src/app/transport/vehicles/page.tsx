"use client";

import { useCallback, useEffect, useState } from "react";
import { Bus, Pencil, Plus, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/transport/TransportShell";
import { VehicleFormModal } from "@/components/transport/VehicleFormModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageTransport,
    createVehicle,
    CreateVehicleInput,
    deleteVehicle,
    fetchRoutes,
    fetchVehicles,
    TransportApiError,
    TransportRoute,
    TransportVehicle,
    updateVehicle,
    UpdateVehicleInput,
} from "@/lib/transport";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function TransportVehiclesPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageTransport(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [rows, setRows] = useState<TransportVehicle[]>([]);
    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<TransportVehicle | null>(null);
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [vehicleList, routeList] = await Promise.all([
                fetchVehicles({ schoolId: isCentral && schoolId ? schoolId : undefined }),
                fetchRoutes({ schoolId: isCentral && schoolId ? schoolId : undefined }),
            ]);
            setRows(vehicleList.vehicles);
            setRoutes(routeList.routes);
        } catch (e) {
            setLoadError(e instanceof TransportApiError ? e.message : "Unable to load vehicles.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async (input: CreateVehicleInput | UpdateVehicleInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            if (editing) {
                await updateVehicle(editing.id, input as UpdateVehicleInput);
                setToast({ message: "Vehicle updated.", type: "success" });
            } else {
                await createVehicle(input as CreateVehicleInput);
                setToast({ message: "Vehicle added.", type: "success" });
            }
            setModalOpen(false);
            setEditing(null);
            load();
        } catch (e) {
            setSubmitError(e instanceof TransportApiError ? e.message : "Unable to save vehicle.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (vehicle: TransportVehicle) => {
        if (!window.confirm(`Delete vehicle "${vehicle.registrationNo}"? This cannot be undone.`)) return;
        setBusy(true);
        try {
            await deleteVehicle(vehicle.id);
            setToast({ message: "Vehicle deleted.", type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof TransportApiError ? e.message : "Unable to delete vehicle.", type: "error" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Vehicles"
                subtitle="Buses and vans, their routes and maintenance status."
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
                            <Plus className="h-4 w-4" /> Add Vehicle
                        </button>
                    ) : undefined
                }
            />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="vehicles-school"
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
                        title="No vehicles yet"
                        description={
                            canManage ? "Add your first vehicle to the fleet." : "No vehicles are registered yet."
                        }
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Vehicle</th>
                                    <th className="px-5 py-3 font-bold">Type</th>
                                    <th className="px-5 py-3 font-bold text-right">Capacity</th>
                                    <th className="px-5 py-3 font-bold">Route</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    {canManage && <th className="px-5 py-3 font-bold text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((vehicle) => (
                                    <tr
                                        key={vehicle.id}
                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                    <Bus className="h-4 w-4" />
                                                </div>
                                                <span className="font-mono text-xs font-bold text-slate-900">
                                                    {vehicle.registrationNo}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">
                                            {vehicle.type === "BUS" ? "Bus" : "Van"}
                                        </td>
                                        <td className="px-5 py-3.5 text-right text-slate-600">{vehicle.capacity}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{vehicle.routeName ?? "Unassigned"}</td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${vehicle.status === "ACTIVE"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                                    }`}
                                            >
                                                {vehicle.status === "ACTIVE" ? "Active" : "Maintenance"}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditing(vehicle);
                                                            setModalOpen(true);
                                                        }}
                                                        aria-label={`Edit ${vehicle.registrationNo}`}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(vehicle)}
                                                        aria-label={`Delete ${vehicle.registrationNo}`}
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

            <VehicleFormModal
                open={modalOpen}
                vehicle={editing}
                routes={routes}
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
