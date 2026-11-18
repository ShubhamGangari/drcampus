"use client";

import { useState } from "react";
import {
    Megaphone,
    X,
    Clock,
    AlertTriangle,
    Wrench,
    Navigation,
    Calendar,
    Send,
    Bus,
    Sparkles,
} from "lucide-react";
import { Toast } from "@/components/admissions/Toast";
import { Field, SelectInput, TextInput, TextArea } from "@/components/admissions/FormControls";
import {
    BroadcastType,
    CreateBroadcastInput,
    createBroadcast,
    TransportRoute,
} from "@/lib/transport";

interface BroadcastModalProps {
    routes: TransportRoute[];
    schoolId: string;
    onClose: () => void;
    onCreated: () => void;
}

const TEMPLATES: {
    label: string;
    type: BroadcastType;
    title: string;
    delayMin?: number;
    message: string;
}[] = [
    {
        label: "⏱️ 15m Traffic Delay",
        type: "DELAY",
        delayMin: 15,
        title: "Morning bus delayed by 15 mins due to traffic",
        message: "Heavy traffic near bypass. The bus is currently running ~15 minutes behind schedule. Please wait at your designated stops.",
    },
    {
        label: "⚠️ 30m Major Delay",
        type: "DELAY",
        delayMin: 30,
        title: "Significant delay due to highway congestion",
        message: "Severe congestion en route. Expected delay of 30 minutes. Students will not be marked late for first-period classes.",
    },
    {
        label: "🛠️ Breakdown / Replacement",
        type: "BREAKDOWN",
        delayMin: 20,
        title: "Bus mechanical issue - Replacement bus en route",
        message: "The designated bus faced a mechanical issue. A replacement bus has been dispatched immediately. Expected pickup delay is 20 minutes.",
    },
    {
        label: "🚧 Route Diversion",
        type: "ROUTE_CHANGE",
        title: "Temporary route diversion due to road work",
        message: "Due to ongoing road construction on the main road, the bus will follow the inner bypass. All regular stops remain the same.",
    },
    {
        label: "❄️ Winter Timing Shift",
        type: "TIMING_UPDATE",
        title: "Winter morning pickup timings revised by +20 mins",
        message: "As per the University Registrar notice, morning bus pickup timings will operate 20 minutes later starting tomorrow due to winter fog.",
    },
];

export function BroadcastModal({
    routes,
    schoolId,
    onClose,
    onCreated,
}: BroadcastModalProps) {
    const [routeId, setRouteId] = useState("");
    const [vehicleNo, setVehicleNo] = useState("");
    const [type, setType] = useState<BroadcastType>("DELAY");
    const [title, setTitle] = useState("");
    const [delayMin, setDelayMin] = useState<string>("15");
    const [message, setMessage] = useState("");
    const [postedBy, setPostedBy] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const applyTemplate = (t: typeof TEMPLATES[number]) => {
        setType(t.type);
        setTitle(t.title);
        setMessage(t.message);
        if (t.delayMin) {
            setDelayMin(String(t.delayMin));
        } else {
            setDelayMin("");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            setToast({ message: "Please provide both title and message.", type: "error" });
            return;
        }

        try {
            setSubmitting(true);
            const input: CreateBroadcastInput = {
                schoolId: schoolId || undefined,
                routeId: routeId || null,
                vehicleNo: vehicleNo.trim() || null,
                type,
                title: title.trim(),
                message: message.trim(),
                delayMin: delayMin ? parseInt(delayMin, 10) : null,
                postedBy: postedBy.trim() || undefined,
            };

            const res = await createBroadcast(input);
            setToast({
                message: `Broadcast posted! Notified ${res.notifiedCount} students on this route.`,
                type: "success",
            });
            setTimeout(() => {
                onCreated();
                onClose();
            }, 1200);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to post broadcast";
            setToast({ message: msg, type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
                            <Megaphone className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-tight">Send Bus Route Broadcast</h2>
                            <p className="text-xs text-white/80 mt-0.5">
                                Instant in-app notice for students holding active passes
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* 1-Click Quick Templates */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3 text-amber-500" /> Quick Templates (WhatsApp Replacement)
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {TEMPLATES.map((tpl, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => applyTemplate(tpl)}
                                    className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-900 transition-all text-slate-700"
                                >
                                    {tpl.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Route & Alert Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Target Bus Route" required>
                            <SelectInput
                                value={routeId}
                                onChange={(e) => setRouteId(e.target.value)}
                            >
                                <option value="">🚨 All Routes (University-wide)</option>
                                {routes.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        Route: {r.name}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>

                        <Field label="Alert Category" required>
                            <SelectInput
                                value={type}
                                onChange={(e) => setType(e.target.value as BroadcastType)}
                            >
                                <option value="DELAY">⏱️ Bus Delay / Traffic Jam</option>
                                <option value="BREAKDOWN">🛠️ Mechanical Breakdown</option>
                                <option value="ROUTE_CHANGE">🚧 Route Diversion</option>
                                <option value="TIMING_UPDATE">⏰ Timing Revision</option>
                                <option value="EMERGENCY">🚨 Urgent Emergency</option>
                            </SelectInput>
                        </Field>
                    </div>

                    {/* Delay & Vehicle Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Delay (Minutes, optional)">
                            <TextInput
                                type="number"
                                min="0"
                                max="300"
                                placeholder="e.g. 15"
                                value={delayMin}
                                onChange={(e) => setDelayMin(e.target.value)}
                            />
                        </Field>

                        <Field label="Vehicle Reg No (Optional)">
                            <TextInput
                                placeholder="e.g. UK-07-PA-1234"
                                value={vehicleNo}
                                onChange={(e) => setVehicleNo(e.target.value)}
                            />
                        </Field>
                    </div>

                    {/* Broadcast Title */}
                    <Field label="Broadcast Heading / Title" required>
                        <TextInput
                            placeholder="e.g. Bus #4 running 15 min late due to Nepali Farm jam"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </Field>

                    {/* Detailed Message */}
                    <Field label="Notice Details / Instructions for Students" required>
                        <TextArea
                            rows={3}
                            placeholder="Enter exact stoppage advice or instructions for boarding students..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                        />
                    </Field>

                    {/* Author / Driver Signature */}
                    <Field label="Posted By (Driver / In-charge Name)">
                        <TextInput
                            placeholder="e.g. Ramesh Singh (Route 4 Driver) / Transport Cell"
                            value={postedBy}
                            onChange={(e) => setPostedBy(e.target.value)}
                        />
                    </Field>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <Send className="h-4 w-4" />
                            {submitting ? "Broadcasting..." : "Dispatch Bus Notice"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
