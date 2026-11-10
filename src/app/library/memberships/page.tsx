"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { PageTitle } from "@/components/library/LibraryShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageLibrary,
    fetchMemberships,
    LibraryApiError,
    LibraryMembership,
    updateMembership,
} from "@/lib/library";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function LibraryMembershipsPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageLibrary(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [rows, setRows] = useState<LibraryMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const list = await fetchMemberships({ schoolId: isCentral && schoolId ? schoolId : undefined });
            setRows(list.memberships);
        } catch (e) {
            setLoadError(e instanceof LibraryApiError ? e.message : "Unable to load memberships.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const toggle = async (m: LibraryMembership) => {
        setBusyId(m.userId);
        try {
            await updateMembership(m.userId, { active: !m.active });
            setToast({ message: m.active ? "Membership deactivated." : "Membership activated.", type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof LibraryApiError ? e.message : "Unable to update membership.", type: "error" });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <PageTitle title="Memberships" subtitle="Library members and their outstanding fines." />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="memberships-school"
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
                        title="No members yet"
                        description="Memberships are auto-created when a book is issued to a member."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Member</th>
                                    <th className="px-5 py-3 font-bold">Type</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    <th className="px-5 py-3 font-bold text-right">Outstanding fines</th>
                                    {canManage && <th className="px-5 py-3 font-bold text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((m) => (
                                    <tr key={m.userId} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                    <Users className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{m.name}</p>
                                                    <p className="text-xs text-slate-500">{m.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{m.type === "STAFF" ? "Staff" : "Student"}</td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${m.active
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                                    }`}
                                            >
                                                {m.active ? "Active" : "Deactivated"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <span className={`font-bold ${m.outstandingFine > 0 ? "text-rose-600" : "text-slate-600"}`}>
                                                ₹{m.outstandingFine.toFixed(2)}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggle(m)}
                                                        disabled={busyId === m.userId}
                                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${m.active
                                                                ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                            }`}
                                                    >
                                                        {busyId === m.userId ? "Updating…" : m.active ? "Deactivate" : "Activate"}
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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
