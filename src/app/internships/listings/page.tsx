"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, MapPin, Clock, X, Send } from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { PageTitle } from "@/components/internships/InternshipsShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import {
    fetchListings,
    createListing,
    applyToInternship,
    canManageInternships,
    INTERNSHIP_MODES,
    type InternshipListing,
    type CreateListingInput,
} from "@/lib/internships";

const MODE_LABEL: Record<string, string> = {
    ON_SITE: "On-site",
    REMOTE: "Remote",
    HYBRID: "Hybrid",
};

const EMPTY_FORM: CreateListingInput = {
    role: "",
    companyName: "",
    mode: "ON_SITE",
    duration: "",
    stipend: "",
    deadline: "",
    description: "",
};

export default function InternshipListingsPage() {
    const { currentUser, initializing } = useUniversity();
    const [listings, setListings] = useState<InternshipListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<CreateListingInput>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [applyingId, setApplyingId] = useState<string | null>(null);

    const canManage = canManageInternships(currentUser);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { listings } = await fetchListings();
            setListings(listings);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load listings");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initializing) return;
        load();
    }, [initializing, load]);

    const handleCreate = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await createListing({
                ...form,
                stipend: form.stipend || undefined,
                deadline: form.deadline || null,
                description: form.description || undefined,
            });
            setShowCreate(false);
            setForm(EMPTY_FORM);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create listing");
        } finally {
            setSubmitting(false);
        }
    };

    const handleApply = async (listingId: string) => {
        setApplyingId(listingId);
        setError(null);
        try {
            await applyToInternship({ listingId });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to apply");
        } finally {
            setApplyingId(null);
        }
    };

    if (initializing) return <LoadingState rows={4} />;

    return (
        <div>
            <PageTitle
                title="Internship Listings"
                subtitle="Browse open roles or manage listings as staff."
                action={canManage && (
                    <button
                        onClick={() => setShowCreate((v) => !v)}
                        className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                        {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        {showCreate ? "Cancel" : "New listing"}
                    </button>
                )}
            />

            {error && <div className="mb-4"><ErrorState message={error} retry={load} /></div>}

            {showCreate && canManage && (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5 mb-6">
                    <h3 className="text-sm font-black text-slate-900 mb-4">Create internship listing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Role</span>
                            <input
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value })}
                                placeholder="e.g. Frontend Intern"
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Company</span>
                            <input
                                value={form.companyName}
                                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                placeholder="Company name"
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Mode</span>
                            <select
                                value={form.mode}
                                onChange={(e) => setForm({ ...form, mode: e.target.value as CreateListingInput["mode"] })}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            >
                                {INTERNSHIP_MODES.map((m) => (
                                    <option key={m} value={m}>{MODE_LABEL[m]}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Duration</span>
                            <input
                                value={form.duration}
                                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                                placeholder="e.g. 6 months"
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Stipend (optional)</span>
                            <input
                                value={form.stipend ?? ""}
                                onChange={(e) => setForm({ ...form, stipend: e.target.value })}
                                placeholder="e.g. ₹15,000/mo"
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Last date (optional)</span>
                            <input
                                type="date"
                                value={form.deadline ?? ""}
                                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </label>
                        <label className="block md:col-span-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Description (optional)</span>
                            <textarea
                                value={form.description ?? ""}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                placeholder="Role summary, responsibilities…"
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </label>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            onClick={handleCreate}
                            disabled={submitting || !form.role.trim() || !form.companyName.trim() || !form.duration.trim()}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            {submitting ? "Creating…" : "Create listing"}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <LoadingState rows={4} />
            ) : error ? (
                <ErrorState message={error} retry={load} />
            ) : listings.length === 0 ? (
                <EmptyState title="No listings yet" description="Add your first internship listing to get started." />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {listings.map((l) => (
                        <div key={l.id} className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5 flex flex-col">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-slate-900 truncate">{l.role}</h3>
                                    <p className="text-[11px] text-slate-500 truncate">{l.companyName}</p>
                                </div>
                            </div>
                            <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                                <p className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                        {MODE_LABEL[l.mode] ?? l.mode}
                                    </span>
                                    <span>{l.duration}</span>
                                </p>
                                {l.stipend && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{l.stipend}</p>}
                                {l.deadline && (
                                    <p className="flex items-center gap-1.5">
                                        <Clock className="h-3 w-3" />
                                        Apply by {new Date(l.deadline).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                            {l.description && (
                                <p className="mt-3 text-xs text-slate-500 line-clamp-2">{l.description}</p>
                            )}
                            <div className="mt-auto pt-4">
                                {canManage ? (
                                    <span className="inline-flex w-full items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-500">
                                        Staff view
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleApply(l.id)}
                                        disabled={applyingId === l.id}
                                        className="inline-flex w-full items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    >
                                        {applyingId === l.id ? "Applying…" : (
                                            <>
                                                <Send className="h-3.5 w-3.5" /> Apply now
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
