"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageTitle } from "@/components/registration/RegistrationShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { COURSE_TYPES, RegistrationApiError, type CourseType, fetchCatalog } from "@/lib/registration";

export default function RegistrationCatalogPage() {
    const [courses, setCourses] = useState<Awaited<ReturnType<typeof fetchCatalog>>["courses"]>([]);
    const [type, setType] = useState<CourseType | "">("");
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchCatalog({ type: type || undefined });
            setCourses(res.courses);
        } catch (e) {
            setLoadError(e instanceof RegistrationApiError ? e.message : "Unable to load the course catalog.");
        } finally {
            setLoading(false);
        }
    }, [type]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return courses;
        return courses.filter(
            (c) =>
                c.title.toLowerCase().includes(q) ||
                c.code.toLowerCase().includes(q) ||
                (c.instructorName ?? "").toLowerCase().includes(q)
        );
    }, [courses, query]);

    return (
        <div>
            <PageTitle title="Course Catalog" subtitle="Browse all offered courses, seats and instructors." />

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by code, title or instructor…"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CourseType | "")}
                    className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All types</option>
                    {COURSE_TYPES.map((t) => (
                        <option key={t} value={t}>
                            {t === "CORE" ? "Core" : "Elective"}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : filtered.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
                    <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700">No courses match</p>
                    <p className="text-xs text-slate-500 mt-1">Try a different search term or type filter.</p>
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50/60">
                                    <th className="px-4 py-3">Code</th>
                                    <th className="px-4 py-3">Title</th>
                                    <th className="px-4 py-3">Credits</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Seats</th>
                                    <th className="px-4 py-3">Instructor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((c) => {
                                    const filled = Math.min(100, c.seatsTotal ? Math.round((c.seatsFilled / c.seatsTotal) * 100) : 0);
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-bold text-slate-900">{c.code}</td>
                                            <td className="px-4 py-3 text-slate-700">{c.title}</td>
                                            <td className="px-4 py-3 text-slate-600">{c.credits}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${c.type === "CORE"
                                                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                            : "bg-amber-50 text-amber-700 border-amber-200"
                                                        }`}
                                                >
                                                    {c.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${filled >= 90 ? "bg-rose-500" : "bg-indigo-500"}`}
                                                            style={{ width: `${filled}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-500">
                                                        {c.seatsFilled}/{c.seatsTotal}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{c.instructorName ?? "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
