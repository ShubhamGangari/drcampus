"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, Search, XCircle } from "lucide-react";
import { PageTitle } from "@/components/questionbank/QuestionbankShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { fetchAllocations } from "@/lib/org-client";
import { fetchCatalog } from "@/lib/registration";
import {
    canManageQuestionbank,
    createQuestion,
    fetchQuestions,
    QuestionbankApiError,
    QUESTION_DIFFICULTIES,
    QUESTION_STATUSES,
    QUESTION_TYPES,
    updateQuestionStatus,
    type QuestionView,
} from "@/lib/questionbank";

interface CourseOption {
    id: string;
    label: string;
}

const STATUS_TONE: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
};

const TYPE_TONE: Record<string, string> = {
    MCQ: "bg-indigo-50 text-indigo-700 border-indigo-200",
    SHORT: "bg-sky-50 text-sky-700 border-sky-200",
    LONG: "bg-violet-50 text-violet-700 border-violet-200",
    PAPER: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

const DIFF_TONE: Record<string, string> = {
    EASY: "bg-emerald-50 text-emerald-700 border-emerald-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    HARD: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function QuestionbankQuestionsPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageQuestionbank(currentUser);
    const isFacultyOnly = !canManage;

    const [questions, setQuestions] = useState<QuestionView[]>([]);
    const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
    const [courseFilter, setCourseFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [createCourseId, setCreateCourseId] = useState("");
    const [unit, setUnit] = useState("");
    const [type, setType] = useState("MCQ");
    const [difficulty, setDifficulty] = useState("MEDIUM");
    const [content, setContent] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [busyId, setBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionOk, setActionOk] = useState<string | null>(null);

    // Course options: faculty see only their allocated courses; managers see the catalog.
    useEffect(() => {
        if (isFacultyOnly && currentUser) {
            fetchAllocations({ facultyUserId: currentUser.id })
                .then((a) =>
                    setCourseOptions(
                        a.map((x) => ({
                            id: x.courseId,
                            label: `${x.courseCode ?? ""} · ${x.courseTitle ?? ""}`,
                        }))
                    )
                )
                .catch(() => setCourseOptions([]));
        } else {
            fetchCatalog()
                .then((c) =>
                    setCourseOptions(c.courses.map((x) => ({ id: x.id, label: `${x.code} · ${x.title}` })))
                )
                .catch(() => setCourseOptions([]));
        }
    }, [isFacultyOnly, currentUser]);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchQuestions({
                courseId: courseFilter || undefined,
                status: statusFilter ? (statusFilter as QuestionView["status"]) : undefined,
            });
            setQuestions(res.questions);
        } catch (err) {
            setLoadError(err instanceof QuestionbankApiError ? err.message : "Unable to load questions.");
        } finally {
            setLoading(false);
        }
    }, [courseFilter, statusFilter]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async () => {
        if (!createCourseId || !content.trim()) return;
        setCreating(true);
        setCreateError(null);
        try {
            await createQuestion({
                courseId: createCourseId,
                unit: unit.trim() || null,
                type: type as QuestionView["type"],
                difficulty: difficulty as QuestionView["difficulty"],
                content: content.trim(),
            });
            setCreateOpen(false);
            setActionOk("Question submitted for approval.");
            setUnit("");
            setContent("");
            setCreateCourseId("");
            setType("MCQ");
            setDifficulty("MEDIUM");
            await load();
        } catch (err) {
            setCreateError(err instanceof QuestionbankApiError ? err.message : "Could not add the question.");
        } finally {
            setCreating(false);
        }
    };

    const handleReview = async (id: string, status: "APPROVED" | "REJECTED") => {
        setBusyId(id);
        setActionError(null);
        setActionOk(null);
        try {
            await updateQuestionStatus(id, { status });
            setActionOk(`Question ${status.toLowerCase()}.`);
            await load();
        } catch (err) {
            setActionError(err instanceof QuestionbankApiError ? err.message : "Could not update the question.");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <PageTitle
                title="Question Bank"
                subtitle="Per-course questions, paper uploads and approvals."
                action={
                    <button
                        type="button"
                        onClick={() => {
                            setCreateError(null);
                            setCreateOpen(!createOpen);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add question
                    </button>
                }
            />

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

            {createOpen && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight mb-1">Add question</h3>
                    <p className="text-xs text-slate-500 mb-4">
                        {isFacultyOnly ? "Adding a question for one of your allocated courses." : "Add a question for any course."}
                    </p>

                    {createError && (
                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 mb-4 text-xs text-rose-700">
                            {createError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Course
                            </label>
                            <select
                                value={createCourseId}
                                onChange={(e) => setCreateCourseId(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select course</option>
                                {courseOptions.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Unit
                            </label>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                placeholder="e.g. 3"
                                className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Type
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {QUESTION_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Difficulty
                            </label>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {QUESTION_DIFFICULTIES.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Content
                            </label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={4}
                                placeholder="Question text or paper upload description…"
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={!createCourseId || !content.trim() || creating}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {creating ? "Submitting…" : "Submit question"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreateOpen(false)}
                            className="inline-flex items-center text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Course
                    </label>
                    <select
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All courses</option>
                        {courseOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Status
                    </label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All statuses</option>
                        {QUESTION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : questions.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                    <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700">No questions found</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting the filters or add a question.</p>
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50/70">
                                    <th className="px-4 py-3">Course</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Difficulty</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Author</th>
                                    {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {questions.map((q) => (
                                    <tr key={q.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-slate-800">{q.courseCode}</p>
                                            {q.unit && <p className="text-[11px] text-slate-400 font-medium">Unit {q.unit}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${TYPE_TONE[q.type] ?? "bg-slate-100 text-slate-600 border-slate-200"
                                                    }`}
                                            >
                                                {q.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${DIFF_TONE[q.difficulty] ?? "bg-slate-100 text-slate-600 border-slate-200"
                                                    }`}
                                            >
                                                {q.difficulty}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_TONE[q.status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                                                    }`}
                                            >
                                                {q.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{q.authorName}</td>
                                        {canManage && (
                                            <td className="px-4 py-3">
                                                {q.status === "SUBMITTED" ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReview(q.id, "APPROVED")}
                                                            disabled={busyId !== null}
                                                            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-40 cursor-pointer"
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReview(q.id, "REJECTED")}
                                                            disabled={busyId !== null}
                                                            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 transition-colors disabled:opacity-40 cursor-pointer"
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" /> Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-right text-xs text-slate-400">—</div>
                                                )}
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
