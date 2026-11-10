"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Megaphone, Pin } from "lucide-react";
import { PageTitle } from "@/components/notices/NoticesShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    fetchNotices,
    markNoticeRead,
    Notice,
    NoticesApiError,
    NOTICE_CATEGORY_LABELS,
} from "@/lib/notices";

const CATEGORY_STYLES: Record<string, string> = {
    EXAM: "bg-violet-50 text-violet-700 border-violet-200",
    FEE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    HOLIDAY: "bg-amber-50 text-amber-700 border-amber-200",
    EVENT: "bg-sky-50 text-sky-700 border-sky-200",
    GENERAL: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function NoticesBoardPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";

    const [schoolId, setSchoolId] = useState("");
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchNotices({
                schoolId: isCentral && schoolId ? schoolId : undefined,
            });
            setNotices(res.notices);
        } catch (e) {
            setLoadError(
                e instanceof NoticesApiError ? e.message : "Unable to load the notice board."
            );
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const toggle = async (id: string) => {
        const next = new Set(expanded);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExpanded(next);
        if (next.has(id)) {
            try {
                await markNoticeRead(id);
            } catch {
                /* read receipt is best-effort */
            }
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    return (
        <div>
            <PageTitle title="Notice Board" subtitle="Official notices and circulars for the university community." />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="board-school"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All schools</option>
                        <option value="SCHOOL_1">School 1</option>
                        <option value="SCHOOL_2">School 2</option>
                    </select>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : notices.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                        <Megaphone className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">No notices published</p>
                    <p className="text-xs text-slate-500 mt-1">
                        Check back later for the latest university announcements.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notices.map((notice) => {
                        const isOpen = expanded.has(notice.id);
                        const categoryLabel = NOTICE_CATEGORY_LABELS[notice.category] ?? notice.category;
                        return (
                            <div
                                key={notice.id}
                                className={`rounded-2xl bg-white border shadow-sm transition-colors ${isOpen ? "border-indigo-200" : "border-slate-200"}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggle(notice.id)}
                                    aria-expanded={isOpen}
                                    className="w-full text-left px-5 py-4 flex items-start gap-3 cursor-pointer"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className={`inline-flex text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${CATEGORY_STYLES[notice.category] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
                                            >
                                                {categoryLabel}
                                            </span>
                                            {notice.pinned && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                                    <Pin className="h-3 w-3" /> Pinned
                                                </span>
                                            )}
                                            {notice.expiresAt && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                                    <CalendarDays className="h-3 w-3 text-slate-400" />
                                                    until {formatDate(notice.expiresAt)}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900 mt-2">{notice.title}</h3>
                                        {isOpen && (
                                            <p className="text-sm text-slate-600 mt-2.5 leading-relaxed whitespace-pre-wrap">
                                                {notice.body}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-400 mt-2.5 font-medium">
                                            Published {formatDate(notice.publishedAt)}
                                        </p>
                                    </div>
                                    <ChevronDown
                                        className={`h-4 w-4 text-slate-400 mt-1 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
