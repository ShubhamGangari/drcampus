"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, FileSearch, Search } from "lucide-react";
import { PageTitle } from "@/components/backlog/BacklogShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    BacklogApiError,
    fetchMyBacklogs,
    fetchSupplementaryExams,
    registerForSupplementaryExam,
    requestRevaluation,
    type BacklogItem,
} from "@/lib/backlog";

export default function BacklogMyPage() {
    const { currentUser } = useUniversity();
    const [backlogs, setBacklogs] = useState<Awaited<ReturnType<typeof fetchMyBacklogs>>["backlogs"]>([]);
    const [exams, setExams] = useState<Awaited<ReturnType<typeof fetchSupplementaryExams>>["exams"]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [requestTarget, setRequestTarget] = useState<BacklogItem | null>(null);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionOk, setActionOk] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [b, e] = await Promise.all([fetchMyBacklogs(), fetchSupplementaryExams()]);
            setBacklogs(b.backlogs);
            setExams(e.exams);
        } catch (err) {
            setLoadError(err instanceof BacklogApiError ? err.message : "Unable to load your backlogs.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleRequestRevaluation = async () => {
        if (!requestTarget || !reason.trim()) return;
        setSubmitting(true);
        setActionError(null);
        setActionOk(null);
        try {
            await requestRevaluation(requestTarget.id, { reason: reason.trim() });
            setActionOk(`Revaluation requested for ${requestTarget.courseCode}.`);
            setRequestTarget(null);
            setReason("");
        } catch (err) {
            setActionError(err instanceof BacklogApiError ? err.message : "Could not request revaluation.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegisterExam = async (examId: string, courseCode: string) => {
        if (!currentUser) return;
        setSubmitting(true);
        setActionError(null);
        setActionOk(null);
        try {
            await registerForSupplementaryExam(examId, { studentId: currentUser.id });
            setActionOk(`Registered for supplementary exam in ${courseCode}.`);
        } catch (err) {
            setActionError(err instanceof BacklogApiError ? err.message : "Could not register for the exam.");
        } finally {
            setSubmitting(false);
        }
    };

    const activeBacklogs = backlogs.filter((b) => b.status === "BACKLOG");
    const anyEligibleExam = exams.some((e) => activeBacklogs.some((b) => b.courseCode === e.courseCode));

    return (
        <div>
            <PageTitle title="My Backlogs" subtitle="Failed courses — request revaluation or register for supplementary exams." />

            {actionOk && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-emerald-800">{actionOk}</p>
                </div>
            )}
            {actionError && (
                <div className="mb-5 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
                    {actionError}
                </div>
            )}

            {requestTarget && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight mb-1">
                        <span className="inline-flex items-center gap-2">
                            <FileSearch className="h-4 w-4 text-indigo-600" /> Request revaluation
                        </span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                        {requestTarget.courseCode} · {requestTarget.courseTitle} — semester {requestTarget.semester}
                    </p>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Reason for the revaluation request…"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={handleRequestRevaluation}
                            disabled={!reason.trim() || submitting}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {submitting ? "Submitting…" : "Submit request"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setRequestTarget(null)}
                            className="inline-flex items-center text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Backlogs</h3>
                        {activeBacklogs.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No active backlogs</p>
                                <p className="text-xs text-slate-500 mt-1">Nothing to act on right now.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {activeBacklogs.map((b) => (
                                    <li key={b.id} className="py-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800">
                                                {b.courseCode} · {b.courseTitle}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Semester {b.semester} · Grade {b.grade} · {b.marks} marks
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActionError(null);
                                                setActionOk(null);
                                                setRequestTarget(b);
                                            }}
                                            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 transition-colors cursor-pointer"
                                        >
                                            Request revaluation
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Supplementary exams</h3>
                        {exams.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No supplementary exams scheduled</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {exams.map((e) => {
                                    const hasBacklog = activeBacklogs.some((b) => b.courseCode === e.courseCode);
                                    return (
                                        <li key={e.id} className="py-3 flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800">
                                                    {e.courseCode} · {e.title}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(e.scheduleDate).toLocaleDateString()} · {e.venue ?? "Venue TBA"}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRegisterExam(e.id, e.courseCode)}
                                                disabled={!hasBacklog || submitting}
                                                className="shrink-0 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                <ClipboardList className="h-3.5 w-3.5" /> Register
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {!anyEligibleExam && exams.length > 0 && (
                            <p className="mt-3 text-xs text-slate-400">
                                Registration is enabled only for courses you have an active backlog in.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
