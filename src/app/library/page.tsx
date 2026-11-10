"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Library, Clock, AlertTriangle, Search } from "lucide-react";
import { PageTitle } from "@/components/library/LibraryShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    fetchBooks,
    fetchLoans,
    LibraryApiError,
} from "@/lib/library";

function SummaryCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof Library;
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

export default function LibraryDashboardPage() {
    const router = useRouter();
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";

    const [schoolId, setSchoolId] = useState("");
    const [books, setBooks] = useState<Awaited<ReturnType<typeof fetchBooks>>["books"]>([]);
    const [loans, setLoans] = useState<Awaited<ReturnType<typeof fetchLoans>>["loans"]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const scoped = isCentral && schoolId ? schoolId : undefined;
            const [b, l] = await Promise.all([fetchBooks({ schoolId: scoped }), fetchLoans({ schoolId: scoped })]);
            setBooks(b.books);
            setLoans(l.loans);
        } catch (e) {
            setLoadError(e instanceof LibraryApiError ? e.message : "Unable to load library summary.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const now = Date.now();
    const activeLoans = loans.filter((loan) => loan.status !== "RETURNED");
    const overdue = activeLoans.filter((loan) => new Date(loan.dueDate).getTime() < now).length;
    const availableCopies = books.reduce((sum, b) => sum + b.availableCopies, 0);

    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.push(query.trim() ? `/library/catalogue?search=${encodeURIComponent(query.trim())}` : "/library/catalogue");
    };

    return (
        <div>
            <PageTitle title="Library Dashboard" subtitle="Catalogue, circulation and fines at a glance." />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="library-school"
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
                <LoadingSkeleton rows={4} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard icon={BookOpen} label="Total books" value={books.length} tone="indigo" />
                        <SummaryCard icon={Library} label="Copies available" value={availableCopies} tone="emerald" />
                        <SummaryCard icon={Clock} label="Currently issued" value={activeLoans.length} tone="amber" />
                        <SummaryCard icon={AlertTriangle} label="Overdue items" value={overdue} tone="rose" />
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                        <form onSubmit={submitSearch} className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search the catalogue by title, author or category…"
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap"
                            >
                                <Search className="h-4 w-4" /> Search
                            </button>
                        </form>
                    </div>

                    {books.length === 0 && (
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                            <EmptyState
                                title="No books in the collection"
                                description="Add books to the catalogue to start tracking circulation."
                            />
                        </div>
                    )}
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
