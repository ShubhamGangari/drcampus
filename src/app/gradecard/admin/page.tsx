"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, ScrollText, Search, ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/gradecard/GradecardShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { fetchSchools, type SchoolOption } from "@/lib/fees";
import {
    GradecardApiError,
    TRANSCRIPT_TYPES,
    canManageGradecard,
    fetchTranscripts,
    issueTranscript,
    type TranscriptType,
} from "@/lib/gradecard";

export default function GradecardAdminPage() {
    const { currentUser, students } = useUniversity();
    const canManage = canManageGradecard(currentUser);

    const [schools, setSchools] = useState<SchoolOption[]>([]);
    const [schoolId, setSchoolId] = useState("");

    const [transcripts, setTranscripts] = useState<Awaited<ReturnType<typeof fetchTranscripts>>["transcripts"]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [studentId, setStudentId] = useState("");
    const [type, setType] = useState<TranscriptType>("SEMESTER");
    const [semester, setSemester] = useState("");
    const [issuing, setIssuing] = useState(false);
    const [issueError, setIssueError] = useState<string | null>(null);
    const [issueOk, setIssueOk] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const t = await fetchTranscripts();
            setTranscripts(t.transcripts);
            if (currentUser?.isCentral) {
                setSchools(await fetchSchools());
            }
        } catch (e) {
            setLoadError(e instanceof GradecardApiError ? e.message : "Unable to load issued transcripts.");
        } finally {
            setLoading(false);
        }
    }, [currentUser?.isCentral]);

    useEffect(() => {
        load();
    }, [load]);

    const handleIssue = async () => {
        if (!studentId) return;
        setIssuing(true);
        setIssueError(null);
        setIssueOk(false);
        try {
            const res = await issueTranscript({
                schoolId: currentUser?.isCentral && schoolId ? schoolId : undefined,
                studentId,
                type,
                semester: type === "SEMESTER" && semester ? Number(semester) : null,
            });
            setIssueOk(true);
            setTranscripts((prev) => [res.transcript, ...prev]);
            setStudentId("");
            setSemester("");
        } catch (e) {
            setIssueError(e instanceof GradecardApiError ? e.message : "Could not issue the transcript.");
        } finally {
            setIssuing(false);
        }
    };

    if (!canManage) {
        return (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                <ShieldAlert className="mx-auto h-10 w-10 text-rose-400 mb-3" />
                <h2 className="text-base font-black text-slate-900">Controller access required</h2>
                <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
                    Issuing transcripts is restricted to the exam controller, registrar and administrator roles.
                </p>
            </div>
        );
    }

    return (
        <div>
            <PageTitle title="Generate & Issue" subtitle="Issue semester or full transcripts to students." />

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 h-fit">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-1">
                            <span className="inline-flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-600" /> Issue transcript
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Select a student and transcript type.</p>

                        {issueOk && (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-4 text-xs text-emerald-800">
                                Transcript issued successfully.
                            </div>
                        )}
                        {issueError && (
                            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 mb-4 text-xs text-rose-700">
                                {issueError}
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
                                    Student
                                </label>
                                <select
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select student</option>
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.fullName} · {s.enrollmentNo}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Type
                                </label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as TranscriptType)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {TRANSCRIPT_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                            {t === "SEMESTER" ? "Semester" : "Full"}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {type === "SEMESTER" && (
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
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleIssue}
                            disabled={!studentId || (type === "SEMESTER" && !semester) || issuing}
                            className="mt-5 w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ScrollText className="h-3.5 w-3.5" />
                            {issuing ? "Issuing…" : "Issue transcript"}
                        </button>
                    </div>

                    <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Issued transcripts</h3>
                        {transcripts.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-700">No transcripts issued yet</p>
                                <p className="text-xs text-slate-500 mt-1">Issued transcripts will appear here.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                            <th className="px-3 py-2.5">Transcript No</th>
                                            <th className="px-3 py-2.5">Student</th>
                                            <th className="px-3 py-2.5">Type</th>
                                            <th className="px-3 py-2.5">Issued</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {transcripts.map((t) => (
                                            <tr key={t.id} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2.5 font-bold text-slate-900">{t.transcriptNo}</td>
                                                <td className="px-3 py-2.5 text-slate-700">{t.studentName}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">
                                                    {new Date(t.issuedAt).toLocaleDateString()}
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
