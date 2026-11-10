"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, Search, ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/questionbank/QuestionbankShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { fetchStaff, type StaffMember } from "@/lib/org-client";
import { fetchSupplementaryExams, type SupplementaryExamView } from "@/lib/backlog";
import {
    assignDuty,
    canManageQuestionbank,
    DUTY_ROLES,
    fetchDuty,
    QuestionbankApiError,
    type DutyView,
} from "@/lib/questionbank";

export default function QuestionbankDutyPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageQuestionbank(currentUser);

    const [duty, setDuty] = useState<DutyView[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [exams, setExams] = useState<SupplementaryExamView[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [facultyUserId, setFacultyUserId] = useState("");
    const [examId, setExamId] = useState("");
    const [date, setDate] = useState("");
    const [venue, setVenue] = useState("");
    const [role, setRole] = useState("INVIGILATOR");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [actionOk, setActionOk] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [d, s, e] = await Promise.all([fetchDuty(), fetchStaff({}), fetchSupplementaryExams()]);
            setDuty(d.duty);
            setStaff(s);
            setExams(e.exams);
        } catch (err) {
            setLoadError(err instanceof QuestionbankApiError ? err.message : "Unable to load duty schedule.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleAssign = async () => {
        if (!facultyUserId || !examId || !date) return;
        setCreating(true);
        setCreateError(null);
        try {
            await assignDuty({
                examId,
                facultyUserId,
                date: new Date(date).toISOString(),
                venue: venue.trim() || null,
                role: role as DutyView["role"],
            });
            setActionOk("Duty assigned.");
            setFacultyUserId("");
            setExamId("");
            setDate("");
            setVenue("");
            setRole("INVIGILATOR");
            const d = await fetchDuty();
            setDuty(d.duty);
        } catch (err) {
            setCreateError(err instanceof QuestionbankApiError ? err.message : "Could not assign duty.");
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
                    Assigning faculty to exam duty is restricted to controller-level and administrator roles.
                </p>
            </div>
        );
    }

    return (
        <div>
            <PageTitle title="Faculty Duty" subtitle="Assign faculty to exam duty and view the schedule." />

            {actionOk && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-emerald-800">{actionOk}</p>
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
                                <CalendarPlus className="h-4 w-4 text-indigo-600" /> Assign duty
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Allocate a faculty member to an exam slot.</p>

                        {createError && (
                            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 mb-4 text-xs text-rose-700">
                                {createError}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Faculty
                                </label>
                                <select
                                    value={facultyUserId}
                                    onChange={(e) => setFacultyUserId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select faculty</option>
                                    {staff.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Exam
                                </label>
                                <select
                                    value={examId}
                                    onChange={(e) => setExamId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select exam</option>
                                    {exams.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.courseCode} · {e.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Date
                                </label>
                                <input
                                    type="datetime-local"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
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
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Role
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {DUTY_ROLES.map((r) => (
                                        <option key={r} value={r}>
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleAssign}
                            disabled={!facultyUserId || !examId || !date || creating}
                            className="mt-5 w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {creating ? "Assigning…" : "Assign duty"}
                        </button>
                    </div>

                    <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Duty schedule</h3>
                        {duty.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No duty assigned</p>
                                <p className="text-xs text-slate-500 mt-1">Assign faculty to exams to build the schedule.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                            <th className="px-3 py-2.5">Faculty</th>
                                            <th className="px-3 py-2.5">Role</th>
                                            <th className="px-3 py-2.5">Date</th>
                                            <th className="px-3 py-2.5">Venue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {duty.map((d) => (
                                            <tr key={d.id} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2.5 font-semibold text-slate-800">{d.facultyName}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                                                        {d.role}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">
                                                    {new Date(d.date).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">{d.venue ?? "—"}</td>
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
