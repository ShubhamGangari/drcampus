"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    Users,
    FileText,
    IndianRupee,
    AlertTriangle,
    CalendarCheck,
    CalendarDays,
    GraduationCap,
    Target,
    Sparkles,
} from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { fetchKpis, Kpis } from "@/lib/cross";
import { resolveEffectivePermissions, hasEffectivePermission, type Permission } from "@/lib/perms";
import { cn } from "@/lib/cn";

interface KpiCardDef {
    key: keyof Kpis;
    label: string;
    icon: React.ElementType;
    format: (v: number) => string;
    /** Icon chip styling (tinted soft background + matching icon color). */
    accent: string;
    /** Tailwind text-color used for the top accent bar. */
    bar: string;
    /** Any of these permissions grant visibility for this metric's module. */
    requires: Permission[];
}

/** Each card is tied to the module(s) it reflects — only roles that can access
 *  that module see the metric. This is the role-aware dashboard guarantee. */
const CARDS: KpiCardDef[] = [
    {
        key: "activeStudents",
        label: "Students",
        icon: Users,
        format: (v) => v.toLocaleString(),
        accent: "text-indigo-600 bg-indigo-50",
        bar: "text-indigo-500",
        requires: ["org.view", "report.view", "dashboard.kpi"],
    },
    {
        key: "pendingApplications",
        label: "Pending Applications",
        icon: FileText,
        format: (v) => v.toLocaleString(),
        accent: "text-violet-600 bg-violet-50",
        bar: "text-violet-500",
        requires: ["admissions.manage", "report.view"],
    },
    {
        key: "feesCollected",
        label: "Fees Collected",
        icon: IndianRupee,
        format: (v) => `₹${(v / 100000).toFixed(1)}L`,
        accent: "text-emerald-600 bg-emerald-50",
        bar: "text-emerald-500",
        requires: ["fees.view", "fees.manage", "payroll.approve"],
    },
    {
        key: "outstandingDues",
        label: "Outstanding Dues",
        icon: AlertTriangle,
        format: (v) => `₹${(v / 100000).toFixed(1)}L`,
        accent: "text-rose-600 bg-rose-50",
        bar: "text-rose-500",
        requires: ["fees.view", "fees.manage"],
    },
    {
        key: "attendanceTodayPercent",
        label: "Attendance Today",
        icon: CalendarCheck,
        format: (v) => `${v.toFixed(1)}%`,
        accent: "text-sky-600 bg-sky-50",
        bar: "text-sky-500",
        requires: ["attendance.view_all", "attendance.mark"],
    },
    {
        key: "upcomingExams",
        label: "Upcoming Exams",
        icon: CalendarDays,
        format: (v) => v.toLocaleString(),
        accent: "text-amber-600 bg-amber-50",
        bar: "text-amber-500",
        requires: ["results.view", "marks.approve", "marks.publish"],
    },
    {
        key: "facultyCount",
        label: "Faculty",
        icon: GraduationCap,
        format: (v) => v.toLocaleString(),
        accent: "text-teal-600 bg-teal-50",
        bar: "text-teal-500",
        requires: ["org.view", "payroll.manage", "payroll.approve"],
    },
    {
        key: "avgCoAttainment",
        label: "Avg CO Attainment",
        icon: Target,
        format: (v) => `${v.toFixed(2)}`,
        accent: "text-fuchsia-600 bg-fuchsia-50",
        bar: "text-fuchsia-500",
        requires: ["obe.view_reports", "obe.edit"],
    },
];

function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

function useCountUp(target: number, duration = 700): number {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (prefersReducedMotion()) {
            setValue(target);
            return;
        }
        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(target * eased));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);

    return value;
}

function KpiCard({ card, value }: { card: KpiCardDef; value: number }) {
    const Icon = card.icon;
    const animated = useCountUp(value);

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <span
                className={cn(
                    "absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-70",
                    card.bar,
                )}
                aria-hidden="true"
            />
            <div className="flex items-center justify-between">
                <span
                    className={cn(
                        "h-9 w-9 rounded-xl border border-slate-100 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105",
                        card.accent,
                    )}
                >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {card.format(animated)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">{card.label}</p>
        </div>
    );
}

export const KpiStrip: React.FC = () => {
    const { currentUser } = useUniversity();
    const [kpis, setKpis] = useState<Kpis | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Merge the authoritative RBAC resolver with any extra grants from the session
    // (e.g. a custom role), so the dashboard honours exactly what the user holds.
    const effective = useMemo(() => {
        const resolved = resolveEffectivePermissions({ role: currentUser?.role });
        const extra = (currentUser?.permissions ?? []) as Permission[];
        return Array.from(new Set([...resolved, ...extra]));
    }, [currentUser?.role, currentUser?.permissions]);

    const canView = hasEffectivePermission(effective, "dashboard.kpi");

    const visibleCards = useMemo(
        () => CARDS.filter((card) => card.requires.some((p) => hasEffectivePermission(effective, p))),
        [effective]
    );

    useEffect(() => {
        if (!canView) return;
        let active = true;
        fetchKpis()
            .then((data) => {
                if (active) setKpis(data);
            })
            .catch(() => {
                if (active) setError("KPI snapshot unavailable.");
            });
        return () => {
            active = false;
        };
    }, [canView]);

    if (!canView) return null;

    return (
        <section className="mb-6" aria-label="University KPIs">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" aria-hidden="true" />
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">University Snapshot</h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider border border-slate-200 bg-white rounded-full px-2.5 py-1">
                    <Sparkles className="h-3 w-3 text-indigo-500" aria-hidden="true" />
                    Live · Tenant-scoped
                </span>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    {error}
                </div>
            )}

            {!error && !kpis && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: Math.max(visibleCards.length, 4) }).map((_, i) => (
                        <div
                            key={i}
                            className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse h-[92px]"
                        />
                    ))}
                </div>
            )}

            {!error && kpis && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {visibleCards.map((card) => (
                        <KpiCard key={card.key} card={card} value={kpis[card.key] ?? 0} />
                    ))}
                </div>
            )}
        </section>
    );
};
