"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, ClipboardList, Search, UserRound } from "lucide-react";
import { PageTitle } from "@/components/backlog/BacklogShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    BacklogApiError,
    fetchMyBacklogs,
    fetchSupplementaryExams,
} from "@/lib/backlog";

function SummaryCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof AlertTriangle;
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

export default function BacklogDashboardPage() {
    const [backlogs, setBacklogs] = useState<Awaited<ReturnType<typeof fetchMyBacklogs>>["backlogs"]>([]);
    const [exams, setExams] = useState<Awaited<ReturnType<typeof fetchSupplementaryExams>>["exams"]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [b, e] = await Promise.all([fetchMyBacklogs(), fetchSupplementaryExams()]);
            setBacklogs(b.backlogs);
            setExams(e.exams);
        } catch (err) {
            setLoadError(err instanceof BacklogApiError ? err.message : "Unable to load backlog summary.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const active = backlogs.filter((b) => b.status === "BACKLOG").length;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = exams.filter((e) => e.scheduleDate >= today).length;

    return (
        <div>
            <PageTitle title="Backlog Dashboard" subtitle="Backlogs, revaluation and supplementary examinations." />

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard icon={AlertTriangle} label="Total backlogs" value={backlogs.length} tone="rose" />
                        <SummaryCard icon={ClipboardList} label="Active backlogs" value={active} tone="amber" />
                        <SummaryCard icon={CalendarClock} label="Supplementary exams" value={exams.length} tone="indigo" />
                        <SummaryCard icon={UserRound} label="Upcoming exams" value={upcoming} tone="emerald" />
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">My backlogs</h3>
                        {backlogs.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No backlogs</p>
                                <p className="text-xs text-slate-500 mt-1">No failed courses on record. Keep it up.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                            <th className="px-3 py-2.5">Course</th>
                                            <th className="px-3 py-2.5">Semester</th>
                                            <th className="px-3 py-2.5">Marks</th>
                                            <th className="px-3 py-2.5">Grade</th>
                                            <th className="px-3 py-2.5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {backlogs.map((b) => (
                                            <tr key={b.id} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2.5">
                                                    <p className="font-bold text-slate-800">{b.courseCode}</p>
                                                    <p className="text-xs text-slate-500">{b.courseTitle}</p>
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">
                                                    Semester {b.semester} · {b.academicYear}
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">{b.marks}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
                                                        {b.grade}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">{b.status}</td>
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
