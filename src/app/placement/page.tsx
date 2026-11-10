"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    Building2,
    Briefcase,
    UserRound,
    ShieldCheck,
    ArrowRight,
} from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { PageTitle } from "@/components/placement/PlacementShell";
import { LoadingSkeleton, ErrorState } from "@/components/admissions/States";
import { canManagePlacement } from "@/lib/placement";
import { fetchCompanies, fetchPosts, fetchMyApplications, fetchAdminApplications } from "@/lib/placement";

export default function PlacementPage() {
    const { currentUser } = useUniversity();
    const canManage = canManagePlacement(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [companies, setCompanies] = useState<number>(0);
    const [posts, setPosts] = useState<number>(0);
    const [apps, setApps] = useState<number>(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [c, p] = await Promise.all([fetchCompanies(), fetchPosts()]);
            setCompanies(c.companies.length);
            setPosts(p.posts.length);

            if (canManage) {
                const a = await fetchAdminApplications();
                setApps(a.applications.length);
            } else {
                const m = await fetchMyApplications();
                setApps(m.applications.length);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load placement overview");
        } finally {
            setLoading(false);
        }
    }, [canManage]);

    useEffect(() => {
        load();
    }, [load]);

    const statCards = [
        { label: "Companies", value: companies, icon: Building2, href: "/placement/companies" },
        { label: "Open Posts", value: posts, icon: Briefcase, href: "/placement/posts" },
        {
            label: canManage ? "Total Applications" : "My Applications",
            value: apps,
            icon: UserRound,
            href: canManage ? "/placement/admin" : "/placement/my",
        },
    ];

    return (
        <div>
            <PageTitle
                title="Placement Cell"
                subtitle="Companies, drives, posts and placement applications."
            />

            {loading ? (
                <LoadingSkeleton rows={3} />
            ) : error ? (
                <ErrorState message={error} onRetry={load} />
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {statCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <Link
                                    key={card.label}
                                    href={card.href}
                                    className="group rounded-2xl bg-white border border-slate-200 shadow-xs p-5 hover:border-indigo-300 hover:shadow-md transition-all"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                    </div>
                                    <p className="text-3xl font-black text-slate-900 mt-4">{card.value}</p>
                                    <p className="text-xs font-semibold text-slate-500 mt-1">{card.label}</p>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="mt-6 rounded-2xl bg-white border border-slate-200 shadow-xs p-6">
                        <h3 className="text-sm font-black text-slate-900">Quick actions</h3>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Link
                                href="/placement/companies"
                                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors"
                            >
                                <Building2 className="h-3.5 w-3.5" /> Companies
                            </Link>
                            <Link
                                href="/placement/posts"
                                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                            >
                                <Briefcase className="h-3.5 w-3.5" /> Browse posts
                            </Link>
                            {canManage ? (
                                <Link
                                    href="/placement/admin"
                                    className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                                >
                                    <ShieldCheck className="h-3.5 w-3.5" /> Manage applications
                                </Link>
                            ) : (
                                <Link
                                    href="/placement/my"
                                    className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                                >
                                    <UserRound className="h-3.5 w-3.5" /> My applications
                                </Link>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
