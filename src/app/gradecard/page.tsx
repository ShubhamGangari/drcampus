"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, FileText, GraduationCap, ScrollText, Search } from "lucide-react";
import { PageTitle } from "@/components/gradecard/GradecardShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    GradecardApiError,
    fetchSemesters,
    fetchTranscripts,
} from "@/lib/gradecard";

function SummaryCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof GraduationCap;
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

export default function GradecardDashboardPage() {
    const [semesters, setSemesters] = useState<Awaited<ReturnType<typeof fetchSemesters>>["semesters"]>([]);
    const [transcripts, setTranscripts] = useState<Awaited<ReturnType<typeof fetchTranscripts>>["transcripts"]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [s, t] = await Promise.all([fetchSemesters(), fetchTranscripts()]);
            setSemesters(s.semesters);
            setTranscripts(t.transcripts);
        } catch (e) {
            setLoadError(e instanceof GradecardApiError ? e.message : "Unable to load grade card summary.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const latest = semesters[semesters.length - 1];
    const fullTranscripts = transcripts.filter((t) => t.type === "FULL").length;

    return (
        <div>
            <PageTitle title="Grade Card Dashboard" subtitle="Semester grade cards, transcripts and verification." />

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard icon={GraduationCap} label="Semesters" value={semesters.length} tone="indigo" />
                        <SummaryCard
                            icon={Award}
                            label="Latest SGPA"
                            value={latest?.sgpa ?? "—"}
                            tone="emerald"
                        />
                        <SummaryCard icon={ScrollText} label="Transcripts issued" value={transcripts.length} tone="amber" />
                        <SummaryCard icon={FileText} label="Full transcripts" value={fullTranscripts} tone="rose" />
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Semester performance</h3>
                        {semesters.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No semester records yet</p>
                                <p className="text-xs text-slate-500 mt-1">Grade cards appear once results are published.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                            <th className="px-3 py-2.5">Semester</th>
                                            <th className="px-3 py-2.5">Academic year</th>
                                            <th className="px-3 py-2.5">Credits</th>
                                            <th className="px-3 py-2.5">SGPA</th>
                                            <th className="px-3 py-2.5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {semesters.map((s) => (
                                            <tr key={s.semester} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2.5 font-bold text-slate-800">
                                                    Semester {s.semester}
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">{s.academicYear}</td>
                                                <td className="px-3 py-2.5 text-slate-600">{s.credits}</td>
                                                <td className="px-3 py-2.5 font-bold text-slate-900">
                                                    {s.sgpa ?? "—"}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span
                                                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${s.sgpa !== null
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-amber-50 text-amber-700 border-amber-200"
                                                            }`}
                                                    >
                                                        {s.sgpa !== null ? "Completed" : "Pending"}
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
