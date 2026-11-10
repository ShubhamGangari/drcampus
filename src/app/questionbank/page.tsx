"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, BookOpen, Hourglass, Search, UserRound } from "lucide-react";
import { PageTitle } from "@/components/questionbank/QuestionbankShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    QuestionbankApiError,
    fetchDuty,
    fetchQuestions,
    type QuestionView,
} from "@/lib/questionbank";

function SummaryCard({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    tone: "indigo" | "emerald" | "amber" | "rose";
}) {
    const tones: Record<string, string> = {
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100",
    };
    return (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${tones[tone]}`}>
                {icon}
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900 tracking-tight">{value}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
        </div>
    );
}

const STATUS_TONE: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function QuestionbankPage() {
    const [questions, setQuestions] = useState<QuestionView[]>([]);
    const [duty, setDuty] = useState<Awaited<ReturnType<typeof fetchDuty>>["duty"]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [q, d] = await Promise.all([fetchQuestions(), fetchDuty()]);
            setQuestions(q.questions);
            setDuty(d.duty);
        } catch (err) {
            setLoadError(err instanceof QuestionbankApiError ? err.message : "Unable to load question bank data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const pending = questions.filter((q) => q.status === "SUBMITTED").length;
    const approved = questions.filter((q) => q.status === "APPROVED").length;

    return (
        <div>
            <PageTitle title="Question Bank" subtitle="Per-course questions, approvals and faculty exam duty." />

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard icon={<BookOpen className="h-5 w-5" />} label="Total questions" value={questions.length} tone="indigo" />
                        <SummaryCard icon={<Hourglass className="h-5 w-5" />} label="Pending approvals" value={pending} tone="amber" />
                        <SummaryCard icon={<BadgeCheck className="h-5 w-5" />} label="Approved" value={approved} tone="emerald" />
                        <SummaryCard icon={<UserRound className="h-5 w-5" />} label="My exam duty" value={duty.length} tone="rose" />
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Recent questions</h3>
                        {questions.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No questions yet</p>
                                <p className="text-xs text-slate-500 mt-1">Questions will appear here once faculty add them.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {questions.slice(0, 8).map((q) => (
                                    <li key={q.id} className="py-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800">
                                                {q.courseCode} · {q.type}
                                                {q.unit ? ` · Unit ${q.unit}` : ""}
                                            </p>
                                            <p className="text-xs text-slate-500">by {q.authorName} · {q.difficulty}</p>
                                        </div>
                                        <span
                                            className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_TONE[q.status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                                                }`}
                                        >
                                            {q.status}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">My exam duty</h3>
                        {duty.length === 0 ? (
                            <div className="text-center py-8">
                                <UserRound className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No duty assigned</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {duty.map((d) => (
                                    <li key={d.id} className="py-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800">{d.role}</p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(d.date).toLocaleString()} · {d.venue ?? "Venue TBA"}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
