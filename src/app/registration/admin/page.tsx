"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CalendarPlus, Search, ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/registration/RegistrationShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { fetchSchools, type SchoolOption } from "@/lib/fees";
import {
    RegistrationApiError,
    canManageRegistration,
    createWindow,
    fetchAllRegistrations,
    fetchWindows,
} from "@/lib/registration";

export default function RegistrationAdminPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageRegistration(currentUser);

    const [schools, setSchools] = useState<SchoolOption[]>([]);
    const [schoolId, setSchoolId] = useState("");

    const [windows, setWindows] = useState<Awaited<ReturnType<typeof fetchWindows>>["windows"]>([]);
    const [all, setAll] = useState<Awaited<ReturnType<typeof fetchAllRegistrations>>["registrations"]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [semester, setSemester] = useState("1");
    const [academicYear, setAcademicYear] = useState("");
    const [opensAt, setOpensAt] = useState("");
    const [closesAt, setClosesAt] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createOk, setCreateOk] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [w, a] = await Promise.all([fetchWindows(), fetchAllRegistrations()]);
            setWindows(w.windows);
            setAll(a.registrations);
            if (currentUser?.isCentral) {
                const s = await fetchSchools();
                setSchools(s);
            }
        } catch (e) {
            setLoadError(e instanceof RegistrationApiError ? e.message : "Unable to load registration admin data.");
        } finally {
            setLoading(false);
        }
    }, [currentUser?.isCentral]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreateWindow = async () => {
        if (!semester || !academicYear || !opensAt || !closesAt) return;
        setCreating(true);
        setCreateError(null);
        setCreateOk(false);
        try {
            await createWindow({
                schoolId: currentUser?.isCentral && schoolId ? schoolId : undefined,
                semester: Number(semester),
                academicYear,
                opensAt: new Date(opensAt).toISOString(),
                closesAt: new Date(closesAt).toISOString(),
            });
            setCreateOk(true);
            setSemester("1");
            setAcademicYear("");
            setOpensAt("");
            setClosesAt("");
            const w = await fetchWindows();
            setWindows(w.windows);
        } catch (e) {
            setCreateError(e instanceof RegistrationApiError ? e.message : "Could not open the registration window.");
        } finally {
            setCreating(false);
        }
    };

    if (!canManage) {
        return (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                <ShieldAlert className="mx-auto h-10 w-10 text-rose-400 mb-3" />
                <h2 className="text-base font-black text-slate-900">Registrar access required</h2>
                <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
                    Opening and closing registration windows, and reviewing all registrations, is restricted to registrar
                    and administrator roles.
                </p>
            </div>
        );
    }

    return (
        <div>
            <PageTitle title="Registration Admin" subtitle="Manage registration windows and review all registrations." />

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 h-fit">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-1">
                            <span className="inline-flex items-center gap-2">
                                <CalendarPlus className="h-4 w-4 text-indigo-600" /> Open registration window
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Create a new window for a semester.</p>

                        {createOk && (
                            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-4">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-emerald-800">Window created.</p>
                            </div>
                        )}
                        {createError && (
                            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 mb-4 text-xs text-rose-700">
                                {createError}
                            </div>
                        )}

                        {currentUser?.isCentral && (
                            <div className="mb-3">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    School
                                </label>
                                <select
                                    value={schoolId}
                                    onChange={(e) => setSchoolId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">All schools</option>
                                    {schools.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Semester
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={semester}
                                    onChange={(e) => setSemester(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Academic year
                                </label>
                                <input
                                    type="text"
                                    value={academicYear}
                                    onChange={(e) => setAcademicYear(e.target.value)}
                                    placeholder="e.g. 2025-26"
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Opens at
                                </label>
                                <input
                                    type="datetime-local"
                                    value={opensAt}
                                    onChange={(e) => setOpensAt(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Closes at
                                </label>
                                <input
                                    type="datetime-local"
                                    value={closesAt}
                                    onChange={(e) => setClosesAt(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateWindow}
                            disabled={!semester || !academicYear || !opensAt || !closesAt || creating}
                            className="mt-5 w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {creating ? "Creating…" : "Open window"}
                        </button>

                        <div className="mt-6 border-t border-slate-100 pt-4">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Recent windows</h4>
                            {windows.length === 0 ? (
                                <p className="text-xs text-slate-400">No windows created yet.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {windows.map((w) => (
                                        <li
                                            key={w.id}
                                            className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700">
                                                    Semester {w.semester} · {w.academicYear}
                                                </p>
                                                <p className="text-[10px] text-slate-400 truncate">
                                                    Closes {new Date(w.closesAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <span
                                                className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${w.active
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-slate-100 text-slate-500 border-slate-200"
                                                    }`}
                                            >
                                                {w.active ? "OPEN" : "CLOSED"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">All registrations</h3>
                        {all.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No registrations yet</p>
                                <p className="text-xs text-slate-500 mt-1">Registrations will appear here once students submit.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                            <th className="px-3 py-2.5">Student</th>
                                            <th className="px-3 py-2.5">Course</th>
                                            <th className="px-3 py-2.5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {all.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2.5 font-semibold text-slate-800">{r.studentName}</td>
                                                <td className="px-3 py-2.5 text-slate-600">{r.courseCode}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                                                        {r.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
