"use client";

import { useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { CreatePassInput, TransportRoute } from "@/lib/transport";
import type { StudentSummary } from "@/lib/students";

interface IssuePassModalProps {
    open: boolean;
    students: StudentSummary[];
    routes: TransportRoute[];
    busy: boolean;
    error: string | null;
    schoolRequired: boolean;
    onClose: () => void;
    onSubmit: (input: CreatePassInput) => void;
}

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function IssuePassModal({
    open,
    students,
    routes,
    busy,
    error,
    schoolRequired,
    onClose,
    onSubmit,
}: IssuePassModalProps) {
    const [studentId, setStudentId] = useState("");
    const [routeId, setRouteId] = useState("");
    const [stop, setStop] = useState("");
    const [validTo, setValidTo] = useState("");
    const [fee, setFee] = useState("");
    const [schoolId, setSchoolId] = useState("");

    if (!open) return null;

    const selectedRoute = routes.find((r) => r.id === routeId) ?? null;
    const activeStops = selectedRoute?.stops ?? [];

    const canSubmit =
        studentId &&
        routeId &&
        stop &&
        validTo &&
        fee.trim() &&
        (!schoolRequired || schoolId);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
            studentId,
            routeId,
            stop,
            validTo,
            fee: Number(fee) || 0,
            schoolId: schoolId || undefined,
        });
    };

    return (
        <Modal
            open={open}
            title="Issue bus pass"
            description="Select a student, route, boarding stop and validity."
            onClose={onClose}
            wide
        >
            <form onSubmit={submit} className="space-y-4">
                {schoolRequired && (
                    <div>
                        <label htmlFor="pass-school" className="block text-xs font-bold text-slate-600 mb-1.5">
                            School
                        </label>
                        <select
                            id="pass-school"
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
                    <label htmlFor="pass-student" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Student
                    </label>
                    <select
                        id="pass-student"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className={inputCls}
                    >
                        <option value="">Select student…</option>
                        {students.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.firstName} {s.lastName}
                                {s.rollNo ? ` (${s.rollNo})` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="pass-route" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Route
                        </label>
                        <select
                            id="pass-route"
                            value={routeId}
                            onChange={(e) => {
                                setRouteId(e.target.value);
                                setStop("");
                            }}
                            className={inputCls}
                        >
                            <option value="">Select route…</option>
                            {routes.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="pass-stop" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Boarding stop
                        </label>
                        <select
                            id="pass-stop"
                            value={stop}
                            onChange={(e) => setStop(e.target.value)}
                            disabled={!selectedRoute}
                            className={inputCls}
                        >
                            <option value="">{selectedRoute ? "Select stop…" : "Choose route first"}</option>
                            {activeStops.map((s) => (
                                <option key={s.order} value={s.name}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="pass-validto" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Valid until
                        </label>
                        <input
                            id="pass-validto"
                            type="date"
                            value={validTo}
                            onChange={(e) => setValidTo(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label htmlFor="pass-fee" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Fee (₹)
                        </label>
                        <input
                            id="pass-fee"
                            type="number"
                            min={0}
                            step="0.01"
                            value={fee}
                            onChange={(e) => setFee(e.target.value)}
                            placeholder="e.g. 4000"
                            className={inputCls}
                        />
                    </div>
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
                        {busy ? "Issuing…" : "Issue pass"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
