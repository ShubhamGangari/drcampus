"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Clock, IndianRupee, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/scholarships/ScholarshipsShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    fetchApplications,
    fetchSchemes,
    ScholarshipsApiError,
    ScholarshipApplication,
    ScholarshipScheme,
} from "@/lib/scholarships";

function SummaryCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof Coins;
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

export default function ScholarshipsDashboardPage() {
    const [schemes, setSchemes] = useState<ScholarshipScheme[]>([]);
    const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [s, a] = await Promise.all([fetchSchemes(), fetchApplications()]);
            setSchemes(s.schemes);
            setApplications(a.applications);
        } catch (e) {
            setLoadError(e instanceof ScholarshipsApiError ? e.message : "Unable to load scholarship data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const activeSchemes = schemes.filter((s) => s.active).length;
    const pending = applications.filter((a) => a.status === "SUBMITTED").length;
    const awarded = applications.filter((a) => a.status === "APPROVED").reduce((sum, a) => sum + a.awardedAmount, 0);

    return (
        <div>
            <PageTitle title="Scholarships" subtitle="Schemes, applications and awarded concessions at a glance." />

            {loading ? (
                <LoadingSkeleton rows={4} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <SummaryCard icon={Coins} label="Active schemes" value={activeSchemes} tone="indigo" />
                        <SummaryCard icon={Clock} label="Pending applications" value={pending} tone="amber" />
                        <SummaryCard icon={IndianRupee} label="Awarded amount" value={`₹${awarded.toLocaleString("en-IN")}`} tone="emerald" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-900">Active schemes</span>
                                <Link href="/scholarships/schemes" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                                    View all
                                </Link>
                            </div>
                            {schemes.filter((s) => s.active).length === 0 ? (
                                <p className="px-5 py-8 text-center text-xs text-slate-500">No active schemes yet.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {schemes.filter((s) => s.active).slice(0, 4).map((s) => (
                                        <li key={s.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">{s.type.replace("_", " ")}</p>
                                            </div>
                                            <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                                                {s.valueKind === "PERCENT" ? `${s.value}%` : `₹${s.value.toLocaleString("en-IN")}`}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-900">My applications</span>
                                <Link href="/scholarships/my" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                                    View all <ArrowRight className="inline h-3.5 w-3.5" />
                                </Link>
                            </div>
                            {applications.length === 0 ? (
                                <p className="px-5 py-8 text-center text-xs text-slate-500">No applications yet.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {applications.slice(0, 4).map((a) => (
                                        <li key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">{a.schemeName}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    {new Date(a.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <span
                                                className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${a.status === "APPROVED"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : a.status === "REJECTED"
                                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                                    }`}
                                            >
                                                {a.status}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
