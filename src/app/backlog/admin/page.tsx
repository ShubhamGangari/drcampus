"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, Search, ShieldAlert, XCircle } from "lucide-react";
import { PageTitle } from "@/components/backlog/BacklogShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { fetchSchools, type SchoolOption } from "@/lib/fees";
import {
    BacklogApiError,
    canManageBacklog,
    createSupplementaryExam,
    fetchAdminRequests,
    fetchSupplementaryExams,
    reviewRevaluation,
    type AdminRequest,
    type SupplementaryExamView,
} from "@/lib/backlog";
import { fetchCatalog, type CatalogCourse } from "@/lib/registration";

export default function BacklogAdminPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageBacklog(currentUser);

    const [schools, setSchools] = useState<SchoolOption[]>([]);
    const [schoolId, setSchoolId] = useState("");

    const [requests, setRequests] = useState<AdminRequest[]>([]);
    const [exams, setExams] = useState<SupplementaryExamView[]>([]);
    const [courses, setCourses] = useState<CatalogCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [busyId, setBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionOk, setActionOk] = useState<string | null>(null);

    const [courseId, setCourseId] = useState("");
    const [scheduleDate, setScheduleDate] = useState("");
    const [venue, setVenue] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [r, e, c] = await Promise.all([
                fetchAdminRequests(),
                fetchSupplementaryExams(),
                fetchCatalog(),
            ]);
            setRequests(r.requests);
            setExams(e.exams);
            setCourses(c.courses);
            if (currentUser?.isCentral) {
                const s = await fetchSchools();
                setSchools(s);
            }
        } catch (err) {
            setLoadError(err instanceof BacklogApiError ? err.message : "Unable to load backlog admin data.");
        } finally {
            setLoading(false);
        }
    }, [currentUser?.isCentral]);

    useEffect(() => {
        load();
    }, [load]);

    const handleReview = async (requestId: string, status: "APPROVED" | "REJECTED") => {
        setBusyId(requestId);
        setActionError(null);
        setActionOk(null);
        try {
            await reviewRevaluation(requestId, { status });
            setActionOk(`Revaluation request ${status.toLowerCase()}.`);
            const r = await fetchAdminRequests();
            setRequests(r.requests);
        } catch (err) {
            setActionError(err instanceof BacklogApiError ? err.message : "Could not review the request.");
        } finally {
            setBusyId(null);
        }
    };

    const handleCreateExam = async () => {
        if (!courseId || !scheduleDate) return;
        setCreating(true);
        setCreateError(null);
        try {
            await createSupplementaryExam({
                schoolId: currentUser?.isCentral && schoolId ? schoolId : undefined,
                courseId,
                scheduleDate: new Date(scheduleDate).toISOString(),
                venue: venue.trim() || null,
            });
            setCreateError(null);
            setActionOk("Supplementary exam scheduled.");
            setCourseId("");
            setScheduleDate("");
            setVenue("");
            const e = await fetchSupplementaryExams();
            setExams(e.exams);
        } catch (err) {
            setCreateError(err instanceof BacklogApiError ? err.message : "Could not schedule the exam.");
        } finally {
            setCreating(false);
        }
    };

    if (!canManage) {
        return (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                <ShieldAlert className="mx-auto h-10 w-10 text-rose-400 mb-3" />
                <h2 className="text-base font-black text-slate-900">Controller access required</h2>
                <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
                    Reviewing revaluation requests and scheduling supplementary exams is restricted to controller-level
                    and administrator roles.
                </p>
            </div>
        );
    }

    return (
        <div>
            <PageTitle title="Backlog Admin" subtitle="Review revaluation requests and schedule supplementary exams." />

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

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 h-fit">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-1">
                            <span className="inline-flex items-center gap-2">
                                <CalendarPlus className="h-4 w-4 text-indigo-600" /> Schedule supplementary exam
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Create an exam slot for a backlog course.</p>

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
                                    Course
                                </label>
                                <select
                                    value={courseId}
                                    onChange={(e) => setCourseId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select course</option>
                                    {courses.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.code} · {c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Schedule date
                                </label>
                                <input
                                    type="datetime-local"
                                    value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Venue
                                </label>
                                <input
                                    type="text"
                                    value={venue}
                                    onChange={(e) => setVenue(e.target.value)}
                                    placeholder="Optional"
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateExam}
                            disabled={!courseId || !scheduleDate || creating}
                            className="mt-5 w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {creating ? "Scheduling…" : "Schedule exam"}
                        </button>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                            <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Revaluation requests</h3>
                            {requests.length === 0 ? (
                                <div className="text-center py-8">
                                    <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-700">No revaluation requests</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                                <th className="px-3 py-2.5">Student</th>
                                                <th className="px-3 py-2.5">Course</th>
                                                <th className="px-3 py-2.5">Semester</th>
                                                <th className="px-3 py-2.5">Status</th>
                                                <th className="px-3 py-2.5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {requests.map((r) => (
                                                <tr key={r.id} className="hover:bg-slate-50/50">
                                                    <td className="px-3 py-2.5 font-semibold text-slate-800">{r.studentName}</td>
                                                    <td className="px-3 py-2.5 text-slate-600">{r.courseCode}</td>
                                                    <td className="px-3 py-2.5 text-slate-500">Sem {r.semester}</td>
                                                    <td className="px-3 py-2.5">
                                                        <span
                                                            className={
                                                                "text-[11px] font-bold px-2.5 py-1 rounded-full border " +
                                                                (r.status === "APPROVED"
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : r.status === "REJECTED"
                                                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                                                        : r.status === "COMPLETED"
                                                                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                                            : "bg-amber-50 text-amber-700 border-amber-200")
                                                            }
                                                        >
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        {r.status === "REQUESTED" ? (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReview(r.id, "APPROVED")}
                                                                    disabled={busyId !== null}
                                                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-40 cursor-pointer"
                                                                >
                                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReview(r.id, "REJECTED")}
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
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                                    {exams.map((e) => (
                                        <li key={e.id} className="py-3 flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800">
                                                    {e.courseCode} · {e.title}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(e.scheduleDate).toLocaleString()} · {e.venue ?? "Venue TBA"}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
