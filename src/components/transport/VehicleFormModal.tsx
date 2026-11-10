"use client";

import { useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import {
    CreateVehicleInput,
    TransportRoute,
    TransportVehicle,
    UpdateVehicleInput,
    VEHICLE_STATUSES,
    VEHICLE_TYPES,
} from "@/lib/transport";

interface VehicleFormModalProps {
    open: boolean;
    vehicle: TransportVehicle | null;
    routes: TransportRoute[];
    busy: boolean;
    error: string | null;
    schoolRequired: boolean;
    onClose: () => void;
    onSubmit: (input: CreateVehicleInput | UpdateVehicleInput) => void;
}

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function VehicleFormModal({
    open,
    vehicle,
    routes,
    busy,
    error,
    schoolRequired,
    onClose,
    onSubmit,
}: VehicleFormModalProps) {
    const [registrationNo, setRegistrationNo] = useState(vehicle?.registrationNo ?? "");
    const [type, setType] = useState<"BUS" | "VAN">(vehicle?.type ?? "BUS");
    const [capacity, setCapacity] = useState(String(vehicle?.capacity ?? 40));
    const [routeId, setRouteId] = useState(vehicle?.routeId ?? "");
    const [status, setStatus] = useState<"ACTIVE" | "MAINTENANCE">(vehicle?.status ?? "ACTIVE");
    const [schoolId, setSchoolId] = useState("");

    if (!open) return null;

    const canSubmit =
        registrationNo.trim() && Number(capacity) > 0 && (!schoolRequired || schoolId);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        const base = {
            registrationNo: registrationNo.trim(),
            type,
            capacity: Number(capacity) || 1,
            routeId: routeId || null,
            status,
        };
        onSubmit(vehicle ? base : { ...base, schoolId: schoolId || undefined });
    };

    return (
        <Modal
            open={open}
            title={vehicle ? "Edit vehicle" : "Add vehicle"}
            description="Vehicles are assigned to at most one route at a time."
            onClose={onClose}
        >
            <form onSubmit={submit} className="space-y-4">
                {schoolRequired && (
                    <div>
                        <label htmlFor="vehicle-school" className="block text-xs font-bold text-slate-600 mb-1.5">
                            School
                        </label>
                        <select
                            id="vehicle-school"
                            value={schoolId}
                            onChange={(e) => setSchoolId(e.target.value)}
                            className={inputCls}
                        >
                            <option value="">Select school…</option>
                            <option value="SCHOOL_1">School 1</option>
                            <option value="SCHOOL_2">School 2</option>
                        </select>
                    </div>
                )}

                <div>
                    <label htmlFor="vehicle-reg" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Registration No
                    </label>
                    <input
                        id="vehicle-reg"
                        value={registrationNo}
                        onChange={(e) => setRegistrationNo(e.target.value)}
                        placeholder="e.g. KA-01-AB-1234"
                        className={inputCls}
                        required
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="vehicle-type" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Type
                        </label>
                        <select
                            id="vehicle-type"
                            value={type}
                            onChange={(e) => setType(e.target.value as "BUS" | "VAN")}
                            className={inputCls}
                        >
                            {VEHICLE_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t === "BUS" ? "Bus" : "Van"}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="vehicle-capacity" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Capacity
                        </label>
                        <input
                            id="vehicle-capacity"
                            type="number"
                            min={1}
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="vehicle-route" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Assigned route
                    </label>
                    <select
                        id="vehicle-route"
                        value={routeId}
                        onChange={(e) => setRouteId(e.target.value)}
                        className={inputCls}
                    >
                        <option value="">Unassigned</option>
                        {routes.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="vehicle-status" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Status
                    </label>
                    <select
                        id="vehicle-status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as "ACTIVE" | "MAINTENANCE")}
                        className={inputCls}
                    >
                        {VEHICLE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {s === "ACTIVE" ? "Active" : "Maintenance"}
                            </option>
                        ))}
                    </select>
                </div>

                {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 h-10 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !canSubmit}
                        className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {busy ? "Saving…" : vehicle ? "Save changes" : "Add vehicle"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
