"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, FileHeart, Save } from "lucide-react";
import { PageTitle } from "@/components/health/HealthShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { canManageHealth, fetchRecords, HealthApiError, HealthRecord, updateRecord } from "@/lib/health";

const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function RecordsPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageHealth(currentUser);

    const [records, setRecords] = useState<HealthRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [filterId, setFilterId] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const [draft, setDraft] = useState({ bloodGroup: "", allergies: "", chronicConditions: "", emergencyContact: "" });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchRecords({ studentId: canManage && filterId ? filterId : undefined });
            setRecords(res.records);
        } catch (e) {
            setLoadError(e instanceof HealthApiError ? e.message : "Unable to load records.");
        } finally {
            setLoading(false);
        }
    }, [canManage, filterId]);

    useEffect(() => {
        load();
    }, [load]);

    const startEdit = (r: HealthRecord) => {
        setEditId(r.studentId);
        setDraft({
            bloodGroup: r.bloodGroup ?? "",
            allergies: r.allergies ?? "",
            chronicConditions: r.chronicConditions ?? "",
            emergencyContact: r.emergencyContact ?? "",
        });
        setError(null);
    };

    const save = async (studentId: string) => {
        setError(null);
        setBusy(true);
        try {
            const res = await updateRecord(studentId, {
                bloodGroup: draft.bloodGroup || null,
                allergies: draft.allergies || null,
                chronicConditions: draft.chronicConditions || null,
                emergencyContact: draft.emergencyContact || null,
            });
            setRecords((prev) => prev.map((r) => (r.studentId === studentId ? res.record : r)));
            setEditId(null);
        } catch (e) {
            setError(e instanceof HealthApiError ? e.message : "Unable to save record.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle title="Health records" subtitle="Confidential per-student health profiles." />

            {canManage && (
                <div className="mb-5 max-w-xs">
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
            )}

            {error && <p className="mb-4 text-xs font-medium text-rose-600">{error}</p>}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : records.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                    <FileHeart className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700">No health records found</p>
                    <p className="text-xs text-slate-500 mt-1">Records are auto-created on first view.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {records.map((r) => (
                        <div key={r.studentId} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Student {r.studentId}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Health profile</p>
                                </div>
                                {canManage && editId !== r.studentId && (
                                    <button
                                        type="button"
                                        onClick={() => startEdit(r)}
                                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors cursor-pointer"
                                    >
                                        Edit
                                    </button>
                                )}
                                {!canManage && <ShieldAlert className="h-5 w-5 text-slate-300" />}
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Blood group
                                    </label>
                                    <input
                                        type="text"
                                        value={editId === r.studentId ? draft.bloodGroup : (r.bloodGroup ?? "")}
                                        onChange={(e) => setDraft((d) => ({ ...d, bloodGroup: e.target.value }))}
                                        readOnly={editId !== r.studentId}
                                        placeholder="—"
                                        className={`${inputCls} ${editId !== r.studentId ? "bg-slate-50" : ""}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Allergies
                                    </label>
                                    <input
                                        type="text"
                                        value={editId === r.studentId ? draft.allergies : (r.allergies ?? "")}
                                        onChange={(e) => setDraft((d) => ({ ...d, allergies: e.target.value }))}
                                        readOnly={editId !== r.studentId}
                                        placeholder="—"
                                        className={`${inputCls} ${editId !== r.studentId ? "bg-slate-50" : ""}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Chronic conditions
                                    </label>
                                    <input
                                        type="text"
                                        value={editId === r.studentId ? draft.chronicConditions : (r.chronicConditions ?? "")}
                                        onChange={(e) => setDraft((d) => ({ ...d, chronicConditions: e.target.value }))}
                                        readOnly={editId !== r.studentId}
                                        placeholder="—"
                                        className={`${inputCls} ${editId !== r.studentId ? "bg-slate-50" : ""}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Emergency contact
                                    </label>
                                    <input
                                        type="text"
                                        value={editId === r.studentId ? draft.emergencyContact : (r.emergencyContact ?? "")}
                                        onChange={(e) => setDraft((d) => ({ ...d, emergencyContact: e.target.value }))}
                                        readOnly={editId !== r.studentId}
                                        placeholder="—"
                                        className={`${inputCls} ${editId !== r.studentId ? "bg-slate-50" : ""}`}
                                    />
                                </div>
                            </div>

                            {canManage && editId === r.studentId && (
                                <div className="mt-4 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => save(r.studentId)}
                                        disabled={busy}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                                    >
                                        <Save className="h-3.5 w-3.5" />
                                        {busy ? "Saving…" : "Save"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditId(null)}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
