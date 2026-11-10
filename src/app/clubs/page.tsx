"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageTitle } from "@/components/clubs/ClubsShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageClubs,
    CLUB_CATEGORIES,
    Club,
    ClubCategory,
    createClub,
    ClubsApiError,
    fetchClubs,
} from "@/lib/clubs";

const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const CATEGORY_TONE: Record<string, string> = {
    TECHNICAL: "bg-indigo-50 text-indigo-700 border-indigo-200",
    CULTURAL: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    SPORTS: "bg-emerald-50 text-emerald-700 border-emerald-200",
    LITERARY: "bg-amber-50 text-amber-700 border-amber-200",
    SOCIAL: "bg-sky-50 text-sky-700 border-sky-200",
    OTHER: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function ClubsDashboardPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageClubs(currentUser);

    const [clubs, setClubs] = useState<Club[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [category, setCategory] = useState("");

    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<{ name: string; category: ClubCategory; description: string }>({
        name: "",
        category: "TECHNICAL",
        description: "",
    });
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchClubs({ category: category || undefined });
            setClubs(res.clubs);
        } catch (e) {
            setLoadError(e instanceof ClubsApiError ? e.message : "Unable to load clubs.");
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async () => {
        setFieldError(null);
        setSubmitError(null);
        if (!form.name.trim()) {
            setFieldError("Club name is required.");
            return;
        }
        setBusy(true);
        try {
            const res = await createClub({
                name: form.name.trim(),
                category: form.category,
                description: form.description.trim() || null,
            });
            setClubs((prev) => [res.club, ...prev]);
            setFormOpen(false);
            setForm({ name: "", category: "TECHNICAL", description: "" });
        } catch (e) {
            setSubmitError(e instanceof ClubsApiError ? e.message : "Unable to create club.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Clubs"
                subtitle="Student clubs, societies and campus events."
                action={
                    canManage ? (
                        <button
                            type="button"
                            onClick={() => {
                                setFormOpen((v) => !v);
                                setSubmitError(null);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> New club
                        </button>
                    ) : undefined
                }
            />

            {formOpen && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-bold text-slate-900 mb-4">Create a club</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Name
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Club name"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Category
                            </label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ClubCategory }))}
                                className={inputCls}
                            >
                                {CLUB_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Description
                            </label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={3}
                                placeholder="About the club…"
                                className={inputCls}
                            />
                        </div>
                    </div>

                    {(fieldError || submitError) && (
                        <p className="mt-3 text-xs font-medium text-rose-600">{fieldError ?? submitError}</p>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                            {busy ? "Creating…" : "Create club"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormOpen(false)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="mb-5 max-w-xs">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Filter by category
                </label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    <option value="">All categories</option>
                    {CLUB_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : clubs.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No clubs found"
                        description="Clubs will appear here once they are created."
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clubs.map((c) => (
                        <Link
                            key={c.id}
                            href={`/clubs/${c.id}`}
                            className="group rounded-2xl bg-white border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-indigo-200 transition-all"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Users className="h-5 w-5" />
                                </div>
                                <span
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${CATEGORY_TONE[c.category] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
                                >
                                    {c.category}
                                </span>
                            </div>
                            <h3 className="mt-3 text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {c.name}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{c.description ?? "—"}</p>
                            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                                <span>
                                    <span className="font-bold text-slate-700">{c.memberCount}</span> members
                                </span>
                                <span className="truncate">{c.coordinatorName ? `Coordinator: ${c.coordinatorName}` : "No coordinator"}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
