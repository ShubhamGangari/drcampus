"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Stethoscope } from "lucide-react";
import { PageTitle } from "@/components/health/HealthShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageHealth,
    createVisit,
    fetchVisits,
    HealthApiError,
    HealthVisit,
    updateVisit,
    VISIT_STATUSES,
    VISIT_TYPES,
} from "@/lib/health";

const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const STATUS_TONE: Record<string, string> = {
    SCHEDULED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    FOLLOW_UP_REQUIRED: "bg-amber-50 text-amber-700 border-amber-200",
};

type VisitForm = {
    studentId: string;
    date: string;
    type: string;
    symptoms: string;
    diagnosis: string;
    prescription: string;
    status: string;
    followUpDate: string;
};

const emptyForm: VisitForm = {
    studentId: "",
    date: "",
    type: "OPD",
    symptoms: "",
    diagnosis: "",
    prescription: "",
    status: "COMPLETED",
    followUpDate: "",
};

export default function VisitsPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageHealth(currentUser);

    const [visits, setVisits] = useState<HealthVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [filterId, setFilterId] = useState("");
    const [filterStatus, setFilterStatus] = useState("");

    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<VisitForm>(emptyForm);
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchVisits({
                studentId: canManage && filterId ? filterId : undefined,
                status: filterStatus || undefined,
            });
            setVisits(res.visits);
        } catch (e) {
            setLoadError(e instanceof HealthApiError ? e.message : "Unable to load visits.");
        } finally {
            setLoading(false);
        }
    }, [canManage, filterId, filterStatus]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async () => {
        setFieldError(null);
        setSubmitError(null);
        if (!form.studentId.trim()) {
            setFieldError("Student ID is required.");
            return;
        }
        if (!form.symptoms.trim()) {
            setFieldError("Symptoms are required.");
            return;
        }
        if (form.status === "FOLLOW_UP_REQUIRED" && !form.followUpDate) {
            setFieldError("Follow-up date is required when status is FOLLOW_UP_REQUIRED.");
            return;
        }
        setBusy(true);
        try {
            const res = await createVisit({
                studentId: form.studentId.trim(),
                date: form.date || undefined,
                type: form.type as "OPD" | "FOLLOW_UP",
                symptoms: form.symptoms.trim(),
                diagnosis: form.diagnosis.trim() || null,
                prescription: form.prescription.trim() || null,
                status: form.status as HealthVisit["status"],
                followUpDate: form.followUpDate || null,
            });
            setVisits((prev) => [res.visit, ...prev]);
            setFormOpen(false);
            setForm(emptyForm);
        } catch (e) {
            setSubmitError(e instanceof HealthApiError ? e.message : "Unable to log visit.");
        } finally {
            setBusy(false);
        }
    };

    const setStatus = async (v: HealthVisit, status: string) => {
        setSubmitError(null);
        setBusy(true);
        try {
            const res = await updateVisit(v.id, { status: status as HealthVisit["status"] });
            setVisits((prev) => prev.map((x) => (x.id === v.id ? res.visit : x)));
        } catch (e) {
            setSubmitError(e instanceof HealthApiError ? e.message : "Unable to update visit.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Visits & appointments"
                subtitle="Log and track medical visits, symptoms and follow-ups."
                action={
                    canManage ? (
                        <button
                            type="button"
                            onClick={() => {
                                setFormOpen((v) => !v);
                                setSubmitError(null);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> Log visit
                        </button>
                    ) : undefined
                }
            />

            {formOpen && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-bold text-slate-900 mb-4">Log a new visit</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Student ID
                            </label>
                            <input
                                type="text"
                                value={form.studentId}
                                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                                placeholder="Student ID"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Date
                            </label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Type
                            </label>
                            <select
                                value={form.type}
                                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                                className={inputCls}
                            >
                                {VISIT_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Status
                            </label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                                className={inputCls}
                            >
                                {VISIT_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {s.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Symptoms
                            </label>
                            <textarea
                                value={form.symptoms}
                                onChange={(e) => setForm((f) => ({ ...f, symptoms: e.target.value }))}
                                rows={2}
                                placeholder="Describe symptoms…"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Diagnosis
                            </label>
                            <input
                                type="text"
                                value={form.diagnosis}
                                onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
                                placeholder="Diagnosis (optional)"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Prescription
                            </label>
                            <input
                                type="text"
                                value={form.prescription}
                                onChange={(e) => setForm((f) => ({ ...f, prescription: e.target.value }))}
                                placeholder="Prescription (optional)"
                                className={inputCls}
                            />
                        </div>
                        {form.status === "FOLLOW_UP_REQUIRED" && (
                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Follow-up date
                                </label>
                                <input
                                    type="date"
                                    value={form.followUpDate}
                                    onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))}
                                    className={inputCls}
                                />
                            </div>
                        )}
                    </div>

                    {(fieldError || submitError) && (
                        <p className="mt-3 text-xs font-medium text-rose-600">{fieldError ?? submitError}</p>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                            <Stethoscope className="h-3.5 w-3.5" />
                            {busy ? "Saving…" : "Log visit"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormOpen(false)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {canManage && (
                <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Filter by student ID
                        </label>
                        <input
                            type="text"
                            value={filterId}
                            onChange={(e) => setFilterId(e.target.value)}
                            placeholder="Student ID (blank = all)"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Filter by status
                        </label>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
                            <option value="">All statuses</option>
                            {VISIT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s.replace("_", " ")}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : visits.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No visits logged"
                        description="Visits will appear here once they are logged."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Student</th>
                                    <th className="px-5 py-3 font-bold">Date</th>
                                    <th className="px-5 py-3 font-bold">Type</th>
                                    <th className="px-5 py-3 font-bold">Symptoms</th>
                                    <th className="px-5 py-3 font-bold">Diagnosis</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    {canManage && <th className="px-5 py-3 font-bold">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visits.map((v) => (
                                    <tr key={v.id} className="hover:bg-slate-50/60">
                                        <td className="px-5 py-3">
                                            <p className="text-xs font-bold text-slate-800">{v.studentName}</p>
                                            <p className="text-[11px] text-slate-500">{v.studentId}</p>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-600">
                                            {new Date(v.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-600">{v.type.replace("_", " ")}</td>
                                        <td className="px-5 py-3 text-xs text-slate-600 max-w-[200px] truncate">
                                            {v.symptoms}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-600 max-w-[160px] truncate">
                                            {v.diagnosis ?? "—"}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span
                                                className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_TONE[v.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
                                            >
                                                {v.status.replace("_", " ")}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-3">
                                                <select
                                                    value={v.status}
                                                    onChange={(e) => setStatus(v, e.target.value)}
                                                    disabled={busy}
                                                    className="text-[11px] font-semibold px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                >
                                                    {VISIT_STATUSES.map((s) => (
                                                        <option key={s} value={s}>
                                                            {s.replace("_", " ")}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
