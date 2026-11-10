"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Printer, Search } from "lucide-react";
import { PageTitle } from "@/components/gradecard/GradecardShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    GradecardApiError,
    fetchSemester,
    fetchSemesters,
} from "@/lib/gradecard";

export default function GradecardMyPage() {
    const [semesters, setSemesters] = useState<Awaited<ReturnType<typeof fetchSemesters>>["semesters"]>([]);
    const [semester, setSemester] = useState<number | "">("");
    const [data, setData] = useState<Awaited<ReturnType<typeof fetchSemester>> | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [cardLoading, setCardLoading] = useState(false);
    const [cardError, setCardError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const s = await fetchSemesters();
                if (!active) return;
                setSemesters(s.semesters);
                if (s.semesters.length > 0) {
                    const last = s.semesters[s.semesters.length - 1];
                    setSemester(last.semester);
                    const res = await fetchSemester({ semester: last.semester, academicYear: last.academicYear });
                    if (active) setData(res);
                }
            } catch (e) {
                if (active) {
                    setLoadError(e instanceof GradecardApiError ? e.message : "Unable to load grade card data.");
                }
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    const loadSemester = useCallback(async (sem: number) => {
        setCardLoading(true);
        setCardError(null);
        try {
            const sum = semesters.find((s) => s.semester === sem);
            const res = await fetchSemester({ semester: sem, academicYear: sum?.academicYear });
            setData(res);
        } catch (e) {
            setCardError(e instanceof GradecardApiError ? e.message : "Could not load this semester's grade card.");
        } finally {
            setCardLoading(false);
        }
    }, [semesters]);

    const handleSelect = (sem: number | "") => {
        setSemester(sem);
        if (sem !== "") loadSemester(sem);
    };

    return (
        <div>
            <PageTitle title="My Grade Card" subtitle="Select a semester to view courses, grades and SGPA." />

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <select
                    value={semester}
                    onChange={(e) => handleSelect(e.target.value ? Number(e.target.value) : "")}
                    className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">Select semester</option>
                    {semesters.map((s) => (
                        <option key={s.semester} value={s.semester}>
                            Semester {s.semester} · {s.academicYear}
                        </option>
                    ))}
                </select>
                {data && (
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                    >
                        <Printer className="h-3.5 w-3.5" /> Print
                    </button>
                )}
            </div>

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={() => window.location.reload()} />
            ) : cardLoading ? (
                <LoadingSkeleton rows={5} />
            ) : cardError ? (
                <ErrorState message={cardError} onRetry={() => semester !== "" && loadSemester(semester)} />
            ) : !data ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
                    <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700">Select a semester</p>
                    <p className="text-xs text-slate-500 mt-1">Pick a term from the dropdown to view its grade card.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 text-center">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">SGPA</p>
                            <p className="text-xl font-black text-slate-900 mt-1">{data.sgpa ?? "—"}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 text-center">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">CGPA</p>
                            <p className="text-xl font-black text-slate-900 mt-1">{data.cgpa ?? "—"}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 text-center">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Courses</p>
                            <p className="text-xl font-black text-slate-900 mt-1">{data.courses.length}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">
                            <span className="inline-flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-indigo-600" /> Semester {semester} grade card
                            </span>
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <th className="px-3 py-2.5">Code</th>
                                        <th className="px-3 py-2.5">Course</th>
                                        <th className="px-3 py-2.5">Credits</th>
                                        <th className="px-3 py-2.5">Internal</th>
                                        <th className="px-3 py-2.5">External</th>
                                        <th className="px-3 py-2.5">Total</th>
                                        <th className="px-3 py-2.5">Grade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.courses.map((c, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50">
                                            <td className="px-3 py-2.5 font-bold text-slate-800">{c.code}</td>
                                            <td className="px-3 py-2.5 text-slate-700">{c.title}</td>
                                            <td className="px-3 py-2.5 text-slate-600">{c.credits}</td>
                                            <td className="px-3 py-2.5 text-slate-600">{c.internalMarks}</td>
                                            <td className="px-3 py-2.5 text-slate-600">{c.externalMarks}</td>
                                            <td className="px-3 py-2.5 font-semibold text-slate-800">{c.totalMarks}</td>
                                            <td className="px-3 py-2.5">
                                                <span
                                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${c.grade && c.grade !== "F"
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                            : "bg-rose-50 text-rose-700 border-rose-200"
                                                        }`}
                                                >
                                                    {c.grade ?? "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
