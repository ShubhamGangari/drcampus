"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle, Plus, RotateCcw, Ticket, User } from "lucide-react";
import { PageTitle } from "@/components/transport/TransportShell";
import { IssuePassModal } from "@/components/transport/IssuePassModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageTransport,
    fetchPasses,
    fetchRoutes,
    issuePass,
    CreatePassInput,
    TransportApiError,
    TransportPass,
    TransportRoute,
    updatePass,
} from "@/lib/transport";
import { fetchStudents, StudentSummary } from "@/lib/students";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const statusStyles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    EXPIRED: "bg-rose-50 text-rose-700 border-rose-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function TransportPassesPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageTransport(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [rows, setRows] = useState<TransportPass[]>([]);
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const scoped = { schoolId: isCentral && schoolId ? schoolId : undefined };
            const passList = await fetchPasses(scoped);
            setRows(passList.passes);
            if (canManage) {
                const [studentList, routeList] = await Promise.all([
                    fetchStudents({ status: "ACTIVE" }),
                    fetchRoutes(scoped),
                ]);
                setStudents(studentList);
                setRoutes(routeList.routes);
            }
        } catch (e) {
            setLoadError(e instanceof TransportApiError ? e.message : "Unable to load bus passes.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId, canManage]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async (input: CreatePassInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            await issuePass(input);
            setToast({ message: "Bus pass issued.", type: "success" });
            setModalOpen(false);
            load();
        } catch (e) {
            setSubmitError(e instanceof TransportApiError ? e.message : "Unable to issue pass.");
        } finally {
            setBusy(false);
        }
    };

    const setStatus = async (pass: TransportPass, status: TransportPass["status"]) => {
        setBusyId(pass.id);
        try {
            await updatePass(pass.id, { status });
            const message =
                status === "ACTIVE"
                    ? "Pass activated."
                    : status === "EXPIRED"
                        ? "Pass expired."
                        : "Pass set to pending.";
            setToast({ message, type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof TransportApiError ? e.message : "Unable to update pass.", type: "error" });
        } finally {
            setBusyId(null);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    return (
        <div>
            <PageTitle
                title="Bus Passes"
                subtitle="Student transport passes, validity and status."
                action={
                    canManage ? (
                        <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> Issue Pass
                        </button>
                    ) : undefined
                }
            />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="passes-school"
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
                        title="No bus passes yet"
                        description={
                            canManage ? "Issue the first bus pass to a student." : "You don't have a bus pass yet."
                        }
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Student</th>
                                    <th className="px-5 py-3 font-bold">Route</th>
                                    <th className="px-5 py-3 font-bold">Stop</th>
                                    <th className="px-5 py-3 font-bold">Valid</th>
                                    <th className="px-5 py-3 font-bold text-right">Fee</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    {canManage && <th className="px-5 py-3 font-bold text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((pass) => (
                                    <tr
                                        key={pass.id}
                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{pass.studentName}</p>
                                                    {pass.rollNo && (
                                                        <p className="text-xs text-slate-500">{pass.rollNo}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{pass.routeName}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{pass.stop}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                <Ticket className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{formatDate(pass.validFrom)}</span>
                                                <span className="text-slate-300">→</span>
                                                <span>{formatDate(pass.validTo)}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-bold text-slate-700">
                                            ₹{pass.fee.toFixed(2)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${statusStyles[pass.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}
                                            >
                                                {pass.status}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    {pass.status === "PENDING" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setStatus(pass, "ACTIVE")}
                                                            disabled={busyId === pass.id}
                                                            aria-label="Activate pass"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {pass.status === "ACTIVE" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setStatus(pass, "EXPIRED")}
                                                            disabled={busyId === pass.id}
                                                            aria-label="Expire pass"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                        >
                                                            <Ban className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {pass.status === "EXPIRED" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setStatus(pass, "ACTIVE")}
                                                            disabled={busyId === pass.id}
                                                            aria-label="Reactivate pass"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </button>
                                                    )}
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

            <IssuePassModal
                open={modalOpen}
                students={students}
                routes={routes}
                busy={busy}
                error={submitError}
                schoolRequired={isCentral}
                onClose={() => {
                    setModalOpen(false);
                    setSubmitError(null);
                }}
                onSubmit={submit}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
