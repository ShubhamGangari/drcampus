"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowRight,
    Briefcase,
    CheckCircle2,
    Clock,
    UserRound,
    ShieldCheck,
} from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { PageTitle } from "@/components/internships/InternshipsShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/admissions/States";
import {
    fetchListings,
    fetchMyInternships,
    fetchAdminInternships,
    canManageInternships,
    type InternshipListing,
    type MyInternship,
    type AdminInternship,
} from "@/lib/internships";

export default function InternshipsHome() {
    const { currentUser, initializing } = useUniversity();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [listings, setListings] = useState<InternshipListing[]>([]);
    const [myInternships, setMyInternships] = useState<MyInternship[]>([]);
    const [adminInternships, setAdminInternships] = useState<AdminInternship[]>([]);

    const canManage = canManageInternships(currentUser);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { listings } = await fetchListings();
            setListings(listings);
            if (canManage) {
                const { internships } = await fetchAdminInternships();
                setAdminInternships(internships);
            } else {
                const { internships } = await fetchMyInternships();
                setMyInternships(internships);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load internship records");
        } finally {
            setLoading(false);
        }
    }, [canManage]);

    useEffect(() => {
        if (initializing) return;
        load();
    }, [initializing, load]);

    if (initializing) return <LoadingSkeleton rows={4} />;
    if (loading) return <LoadingSkeleton rows={4} />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    const records = canManage ? adminInternships : myInternships;
    const ongoing = records.filter((r) => r.status === "ONGOING").length;
    const completed = records.filter((r) => r.status === "COMPLETED").length;

    const stats = [
        { label: "Open Listings", value: listings.length, icon: Briefcase, href: "/internships/listings", tint: "bg-indigo-50 border-indigo-100 text-indigo-600" },
        { label: "Applications", value: records.length, icon: UserRound, href: canManage ? "/internships/admin" : "/internships/my", tint: "bg-sky-50 border-sky-100 text-sky-600" },
        { label: "Ongoing", value: ongoing, icon: Clock, href: canManage ? "/internships/admin" : "/internships/my", tint: "bg-amber-50 border-amber-100 text-amber-600" },
        { label: "Completed", value: completed, icon: CheckCircle2, href: canManage ? "/internships/admin" : "/internships/my", tint: "bg-emerald-50 border-emerald-100 text-emerald-600" },
    ];

    return (
        <div>
            <PageTitle
                title="Internships"
                subtitle="Track listings, applications and internship completion."
            />

            {listings.length === 0 && records.length === 0 ? (
                <EmptyState
                    title="No internship activity yet"
                    description="Browse listings to apply, or create listings as staff to get started."
                />
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((s) => {
                        const Icon = s.icon;
                        return (
                            <Link
                                key={s.label}
                                href={s.href}
                                className="group rounded-2xl bg-white border border-slate-200 shadow-xs p-5 hover:border-indigo-200 hover:shadow-2xs transition-all"
                            >
                                <div className={`inline-flex h-10 w-10 rounded-xl border items-center justify-center ${s.tint}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <p className="mt-3 text-2xl font-black text-slate-900 tabular-nums">{s.value}</p>
                                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                    {s.label}
                                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                                </p>
                            </Link>
                        );
                    })}
                </div>
            )}

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/internships/listings" className="rounded-2xl bg-indigo-600 text-white p-5 hover:bg-indigo-700 transition-colors">
                    <Briefcase className="h-5 w-5" />
                    <p className="mt-2 text-sm font-black">Browse listings</p>
                    <p className="text-xs text-indigo-100 mt-0.5">Apply to open internship roles</p>
                </Link>
                <Link href={canManage ? "/internships/admin" : "/internships/my"} className="rounded-2xl bg-white border border-slate-200 p-5 hover:border-indigo-200 transition-colors">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    <p className="mt-2 text-sm font-black text-slate-900">{canManage ? "Manage applications" : "My internships"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{canManage ? "Approve and record completion" : "View your status updates"}</p>
                </Link>
            </div>
        </div>
    );
}
