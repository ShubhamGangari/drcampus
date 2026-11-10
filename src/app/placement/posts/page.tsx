"use client";

import { useEffect, useState, useCallback } from "react";
import { Briefcase, Plus, Package, Calendar, ArrowRight } from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { PageTitle } from "@/components/placement/PlacementShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/admissions/States";
import { canManagePlacement } from "@/lib/placement";
import { fetchPosts, createPost, fetchCompanies, applyToPost } from "@/lib/placement";
import type { PlacementPost } from "@/lib/placement";

export default function PlacementPostsPage() {
    const { currentUser } = useUniversity();
    const canManage = canManagePlacement(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [posts, setPosts] = useState<PlacementPost[]>([]);
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        title: "",
        companyId: "",
        package: "",
        deadline: "",
        eligibility: "",
    });
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [p, c] = await Promise.all([fetchPosts(), fetchCompanies()]);
            setPosts(p.posts);
            setCompanies(c.companies.map((x) => ({ id: x.id, name: x.name })));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load posts");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreatePost = async () => {
        setFormError(null);
        setSubmitting(true);
        try {
            await createPost({
                title: form.title.trim(),
                companyId: form.companyId,
                package: form.package.trim() || undefined,
                deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
                eligibility: form.eligibility.trim() || undefined,
            });
            setForm({ title: "", companyId: "", package: "", deadline: "", eligibility: "" });
            setShowForm(false);
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Failed to create post");
        } finally {
            setSubmitting(false);
        }
    };

    const handleApply = async (postId: string) => {
        setError(null);
        try {
            await applyToPost({ postId });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to apply");
        }
    };

    return (
        <div>
            <PageTitle
                title="Placement Posts"
                subtitle="Open opportunities posted by partner companies."
                action={
                    canManage ? (
                        <button
                            onClick={() => setShowForm((v) => !v)}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                        >
                            {showForm ? <><ArrowRight className="h-3.5 w-3.5 rotate-180" /> Cancel</> : <><Plus className="h-3.5 w-3.5" /> New post</>}
                        </button>
                    ) : undefined
                }
            />

            {canManage && showForm && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-xs p-5">
                    <h3 className="text-sm font-black text-slate-900 mb-4">New placement post</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title *</label>
                            <input
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="e.g. Software Engineer"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company *</label>
                            <select
                                value={form.companyId}
                                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
                            >
                                <option value="">Select company</option>
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Package</label>
                            <input
                                value={form.package}
                                onChange={(e) => setForm({ ...form, package: e.target.value })}
                                placeholder="e.g. 12 LPA"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Application deadline</label>
                            <input
                                type="datetime-local"
                                value={form.deadline}
                                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Eligibility</label>
                            <input
                                value={form.eligibility}
                                onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
                                placeholder="e.g. B.Tech CSE/IT, 2026 batch"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                    </div>
                    {formError && <p className="mt-3 text-xs font-semibold text-rose-600">{formError}</p>}
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleCreatePost}
                            disabled={submitting || !form.title.trim() || !form.companyId}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" /> {submitting ? "Creating…" : "Create post"}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : error ? (
                <ErrorState message={error} onRetry={load} />
            ) : posts.length === 0 ? (
                <EmptyState title="No posts yet" description="Placement posts will appear here once published." />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {posts.map((post) => (
                        <div key={post.id} className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5 flex flex-col">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Briefcase className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-slate-900 truncate">{post.title}</h3>
                                    <p className="text-[11px] text-slate-500 truncate">{post.companyName}</p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                {post.package && (
                                    <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{post.package}</span>
                                )}
                                {post.deadline && (
                                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Due {new Date(post.deadline).toLocaleDateString()}</span>
                                )}
                            </div>
                            {post.eligibility && (
                                <p className="mt-2 text-[11px] text-slate-500">{post.eligibility}</p>
                            )}

                            <div className="mt-auto pt-4">
                                {canManage ? (
                                    <span className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 text-slate-500">Staff view</span>
                                ) : (
                                    <button
                                        onClick={() => handleApply(post.id)}
                                        className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                                    >
                                        Apply now
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
