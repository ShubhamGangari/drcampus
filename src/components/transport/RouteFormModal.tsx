"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/admissions/Modal";
import {
    CreateRouteInput,
    TransportRoute,
    UpdateRouteInput,
} from "@/lib/transport";

interface RouteFormModalProps {
    open: boolean;
    route: TransportRoute | null;
    busy: boolean;
    error: string | null;
    schoolRequired: boolean;
    onClose: () => void;
    onSubmit: (input: CreateRouteInput | UpdateRouteInput) => void;
}

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function RouteFormModal({
    open,
    route,
    busy,
    error,
    schoolRequired,
    onClose,
    onSubmit,
}: RouteFormModalProps) {
    const [name, setName] = useState(route?.name ?? "");
    const [stops, setStops] = useState<{ name: string; time: string }[]>(
        route?.stops.map((s) => ({ name: s.name, time: s.time ?? "" })) ?? [
            { name: "", time: "" },
        ]
    );
    const [distanceKm, setDistanceKm] = useState(
        route?.distanceKm != null ? String(route.distanceKm) : ""
    );
    const [schoolId, setSchoolId] = useState("");

    if (!open) return null;

    const canSubmit =
        name.trim() &&
        stops.length > 0 &&
        stops.every((s) => s.name.trim()) &&
        (!schoolRequired || schoolId);

    const updateStop = (i: number, patch: Partial<{ name: string; time: string }>) => {
        setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        const base = {
            name: name.trim(),
            stops: stops.map((s, i) => ({
                name: s.name.trim(),
                order: i + 1,
                time: s.time.trim() || null,
            })),
            distanceKm: distanceKm.trim() ? Number(distanceKm) : null,
        };
        onSubmit(route ? base : { ...base, schoolId: schoolId || undefined });
    };

    return (
        <Modal
            open={open}
            title={route ? "Edit route" : "Add route"}
            description="Routes define the ordered stops a bus serves."
            onClose={onClose}
            wide
        >
            <form onSubmit={submit} className="space-y-4">
                {schoolRequired && (
                    <div>
                        <label htmlFor="route-school" className="block text-xs font-bold text-slate-600 mb-1.5">
                            School
                        </label>
                        <select
                            id="route-school"
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
                    <label htmlFor="route-name" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Route name
                    </label>
                    <input
                        id="route-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. A Block – Main Gate"
                        className={inputCls}
                        required
                    />
                </div>

                <div>
                    <span className="block text-xs font-bold text-slate-600 mb-1.5">Stops (in order)</span>
                    <div className="space-y-2">
                        {stops.map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="h-8 w-8 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                    {i + 1}
                                </span>
                                <input
                                    value={s.name}
                                    onChange={(e) => updateStop(i, { name: e.target.value })}
                                    placeholder="Stop name"
                                    className={inputCls}
                                    aria-label={`Stop ${i + 1} name`}
                                />
                                <input
                                    value={s.time}
                                    onChange={(e) => updateStop(i, { time: e.target.value })}
                                    placeholder="Arrival HH:MM"
                                    className={`${inputCls} w-32 shrink-0`}
                                    aria-label={`Stop ${i + 1} arrival time`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setStops((prev) => prev.filter((_, idx) => idx !== i))}
                                    disabled={stops.length <= 1}
                                    aria-label={`Remove stop ${i + 1}`}
                                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition-colors cursor-pointer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => setStops((prev) => [...prev, { name: "", time: "" }])}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add stop
                    </button>
                </div>

                <div>
                    <label htmlFor="route-distance" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Distance (km)
                    </label>
                    <input
                        id="route-distance"
                        type="number"
                        min={0}
                        step="0.1"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                        placeholder="Optional"
                        className={inputCls}
                    />
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
                        {busy ? "Saving…" : route ? "Save changes" : "Add route"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
