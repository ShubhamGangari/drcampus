"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, GraduationCap, Percent, IndianRupee, Star, Bell } from "lucide-react";
import { PageTitle } from "@/components/parent/ParentShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Badge } from "@/components/ui/Badge";
import { ParentWardCard, ParentApiError, fetchParentWards } from "@/lib/parent";

function formatINR(value: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);
}

function StatPill({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: React.ElementType;
    label: string;
    value: string | null;
    tone?: "success" | "warning" | "danger" | "neutral";
}) {
    const toneCls: Record<string, string> = {
        success: "bg-emerald-50 text-emerald-700 border-emerald-100",
        warning: "bg-amber-50 text-amber-700 border-amber-100",
        danger: "bg-rose-50 text-rose-700 border-rose-100",
        neutral: "bg-slate-50 text-slate-700 border-slate-200",
    };
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${toneCls[tone ?? "neutral"]}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
                <p className="text-sm font-black truncate">{value ?? "—"}</p>
            </div>
        </div>
    );
}

export default function ParentDashboardPage() {
    const [wards, setWards] = useState<ParentWardCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchParentWards();
            setWards(data.students);
        } catch (e) {
            setError(e instanceof ParentApiError ? e.message : "Unable to load your linked wards.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div>
            <PageTitle
                title="My Wards"
                subtitle="Progress and performance for the students linked to your account."
            />

            {loading && <LoadingSkeleton rows={3} />}

            {!loading && error && <ErrorState message={error} onRetry={load} />}

            {!loading && !error && wards.length === 0 && (
                <EmptyState
                    title="No linked students"
                    description="No students are linked to your account yet. Please contact the registrar or school admin to set up ward links, or use the Manage Links panel if you have permission."
                />
            )}

            {!loading && !error && wards.length > 0 && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {wards.map((ward) => (
                        <Link
                            key={ward.id}
                            href={`/portal/parent/${ward.id}`}
                            className="group bg-white border border-slate-200 rounded-2xl shadow-sm p-5 transition-all hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                        <GraduationCap className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900 truncate">{ward.name}</p>
                                        <p className="text-[11px] text-slate-500 font-medium truncate">
                                            {ward.rollNo} · {ward.program}
                                        </p>
                                    </div>
                                </div>
                                {ward.unreadNotices > 0 && (
                                    <Badge variant="warning" className="shrink-0 gap-1">
                                        <Bell className="h-3 w-3" /> {ward.unreadNotices}
                                    </Badge>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-500 font-medium mb-3">{ward.className}</p>

                            <div className="grid grid-cols-2 gap-2">
                                <StatPill
                                    icon={Percent}
                                    label="Attendance"
                                    value={ward.attendancePercent != null ? `${ward.attendancePercent.toFixed(1)}%` : "—"}
                                    tone={ward.attendancePercent == null ? "neutral" : ward.attendancePercent >= 75 ? "success" : "warning"}
                                />
                                <StatPill
                                    icon={IndianRupee}
                                    label="Fee Dues"
                                    value={formatINR(ward.feeDues)}
                                    tone={ward.feeDues > 0 ? "danger" : "success"}
                                />
                                <StatPill
                                    icon={Star}
                                    label="Latest GPA"
                                    value={ward.gpa != null ? ward.gpa.toFixed(2) : "—"}
                                    tone="neutral"
                                />
                                <div className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold">
                                    View details
                                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
