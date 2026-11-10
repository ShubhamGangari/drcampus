"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, CalendarClock, ClipboardList, GraduationCap, Search } from "lucide-react";
import { PageTitle } from "@/components/registration/RegistrationShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    RegistrationApiError,
    fetchCatalog,
    fetchMyRegistrations,
    fetchWindows,
} from "@/lib/registration";

function SummaryCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof BookOpen;
    label: string;
    value: string | number;
    tone: "indigo" | "emerald" | "amber" | "rose";
}) {
    const tones: Record<typeof tone, string> = {
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100",
    };
    return (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex items-start gap-4">
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone]}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{value}</p>
            </div>
        </div>
    );
}

export default function RegistrationDashboardPage() {
    const [courses, setCourses] = useState<Awaited<ReturnType<typeof fetchCatalog>>["courses"]>([]);
    const [windows, setWindows] = useState<Awaited<ReturnType<typeof fetchWindows>>["windows"]>([]);
    const [my, setMy] = useState<Awaited<ReturnType<typeof fetchMyRegistrations>>["registrations"]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [c, w, m] = await Promise.all([
                fetchCatalog(),
                fetchWindows(),
                fetchMyRegistrations(),
            ]);
            setCourses(c.courses);
            setWindows(w.windows);
            setMy(m.registrations);
        } catch (e) {
            setLoadError(e instanceof RegistrationApiError ? e.message : "Unable to load registration summary.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const activeWindows = windows.filter((w) => w.active).length;
    const myCredits = my.reduce((sum, r) => sum + (r.status === "REGISTERED" ? r.credits : 0), 0);
    const seatsOpen = courses.reduce((sum, c) => sum + Math.max(0, c.seatsTotal - c.seatsFilled), 0);

    return (
        <div>
            <PageTitle title="Registration Dashboard" subtitle="Course catalog, registration windows and your enrolments." />

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard icon={BookOpen} label="Catalog courses" value={courses.length} tone="indigo" />
                        <SummaryCard icon={CalendarClock} label="Active windows" value={activeWindows} tone="emerald" />
                        <SummaryCard icon={ClipboardList} label="My registrations" value={my.length} tone="amber" />
                        <SummaryCard icon={GraduationCap} label="Credits registered" value={myCredits} tone="rose" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                            <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Registration windows</h3>
                            {windows.length === 0 ? (
                                <div className="text-center py-8">
                                    <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-700">No windows yet</p>
                                    <p className="text-xs text-slate-500 mt-1">Admins can open a window in the Admin tab.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {windows.map((w) => (
                                        <li key={w.id} className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">
                                                    Semester {w.semester} · {w.academicYear}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Opens {new Date(w.opensAt).toLocaleDateString()} · Closes{" "}
                                                    {new Date(w.closesAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${w.active
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-slate-100 text-slate-500 border-slate-200"
                                                    }`}
                                            >
                                                {w.active ? "Active" : "Closed"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                            <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Seat availability</h3>
                            <p className="text-xs text-slate-500 mb-4">
                                {seatsOpen} seats still open across {courses.length} offered courses.
                            </p>
                            <div className="space-y-2.5">
                                {courses.slice(0, 5).map((c) => {
                                    const pct = c.seatsTotal ? Math.round((c.seatsFilled / c.seatsTotal) * 100) : 0;
                                    return (
                                        <div key={c.id}>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="font-semibold text-slate-700">
                                                    {c.code} · {c.title}
                                                </span>
                                                <span className="text-slate-500">
                                                    {c.seatsFilled}/{c.seatsTotal}
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${pct >= 90 ? "bg-rose-500" : "bg-indigo-500"}`}
                                                    style={{ width: `${Math.min(100, pct)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
