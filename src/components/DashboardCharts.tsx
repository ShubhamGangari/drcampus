"use client";

import React, { useId, useMemo, useState, useEffect } from "react";
import {
    CalendarCheck,
    IndianRupee,
    Sparkles,
    TrendingUp,
    Users,
} from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import {
    fetchTrends,
    type AttendanceTrendPoint,
    type DashboardTrends,
    type TrendPoint,
} from "@/lib/cross";
import {
    resolveEffectivePermissions,
    hasEffectivePermission,
    type Permission,
} from "@/lib/perms";
import { cn } from "@/lib/cn";

const FEE_ACCENT = { from: "#6366f1", to: "#a5b4fc", text: "text-indigo-600", soft: "bg-indigo-50" };
const APP_ACCENT = { from: "#8b5cf6", to: "#c4b5fd", text: "text-violet-600", soft: "bg-violet-50" };
const PRESENT = { from: "#10b981", to: "#6ee7b7" };
const ABSENT = { from: "#f43f5e", to: "#fda4af" };

interface ChartCardDef {
    key: keyof DashboardTrends;
    title: string;
    subtitle: string;
    icon: React.ElementType;
    /** Any of these permissions grant visibility for this chart's module. */
    requires: Permission[];
}

const CHART_CARDS: ChartCardDef[] = [
    {
        key: "feesMonthly",
        title: "Fees Collection",
        subtitle: "Monthly inflow · last 6 months",
        icon: IndianRupee,
        requires: ["fees.view", "fees.manage", "payroll.approve"],
    },
    {
        key: "applicationsMonthly",
        title: "Applications",
        subtitle: "New applications · last 6 months",
        icon: Users,
        requires: ["admissions.manage"],
    },
    {
        key: "attendanceWeekly",
        title: "Attendance",
        subtitle: "Present vs absent · last 8 weeks",
        icon: CalendarCheck,
        requires: ["attendance.mark", "attendance.view_all", "report.view"],
    },
];

const fmtFee = (v: number): string => `₹${(v / 100000).toFixed(1)}L`;
const fmtCount = (v: number): string => v.toLocaleString("en-US");
const sum = (nums: readonly number[]): number => nums.reduce((a, b) => a + b, 0);

/** Dependency-free vertical bar chart rendered as inline SVG (scales to width). */
function MiniBarChart({
    points,
    formatValue,
    accent,
    ariaLabel,
}: {
    points: TrendPoint[];
    formatValue: (v: number) => string;
    accent: typeof FEE_ACCENT;
    ariaLabel: string;
}) {
    const gid = useId();
    const W = 360;
    const H = 180;
    const padL = 8;
    const padR = 8;
    const padT = 18;
    const padB = 26;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const max = Math.max(1, ...points.map((p) => p.value));
    const slot = innerW / points.length;
    const barW = Math.max(6, slot * 0.5);
    const grid = [0, 0.25, 0.5, 0.75, 1];

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={ariaLabel}
            className="w-full h-auto"
        >
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent.from} />
                    <stop offset="100%" stopColor={accent.to} />
                </linearGradient>
            </defs>

            {/* gridlines */}
            {grid.map((f) => {
                const y = padT + innerH * (1 - f);
                return (
                    <line
                        key={f}
                        x1={padL}
                        y1={y}
                        x2={padL + innerW}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                    />
                );
            })}

            {points.map((p, i) => {
                const h = innerH * (p.value / max);
                const x = padL + i * slot + (slot - barW) / 2;
                const y = padT + innerH - h;
                return (
                    <g key={p.label}>
                        <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={Math.max(h, p.value > 0 ? 2 : 0)}
                            rx={barW / 2}
                            fill={`url(#${gid})`}
                        >
                            <title>{`${p.label}: ${formatValue(p.value)}`}</title>
                        </rect>
                        <text
                            x={padL + i * slot + slot / 2}
                            y={y - 5}
                            textAnchor="middle"
                            className="fill-slate-500"
                            fontSize="9"
                            fontWeight="600"
                        >
                            {formatValue(p.value)}
                        </text>
                        <text
                            x={padL + i * slot + slot / 2}
                            y={padT + innerH + 17}
                            textAnchor="middle"
                            className="fill-slate-400"
                            fontSize="9"
                        >
                            {p.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

/** Dependency-free grouped (present/absent) bar chart for attendance. */
function GroupedBarChart({
    points,
    ariaLabel,
}: {
    points: AttendanceTrendPoint[];
    ariaLabel: string;
}) {
    const presentId = useId();
    const absentId = useId();
    const W = 360;
    const H = 180;
    const padL = 8;
    const padR = 8;
    const padT = 18;
    const padB = 26;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const max = Math.max(
        1,
        ...points.flatMap((p): number[] => [p.present, p.absent])
    );
    const slot = innerW / points.length;
    const barW = Math.max(5, slot * 0.24);

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={ariaLabel}
            className="w-full h-auto"
        >
            <defs>
                <linearGradient id={presentId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRESENT.from} />
                    <stop offset="100%" stopColor={PRESENT.to} />
                </linearGradient>
                <linearGradient id={absentId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ABSENT.from} />
                    <stop offset="100%" stopColor={ABSENT.to} />
                </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const y = padT + innerH * (1 - f);
                return (
                    <line
                        key={f}
                        x1={padL}
                        y1={y}
                        x2={padL + innerW}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                    />
                );
            })}

            {points.map((p, i) => {
                const center = padL + i * slot + slot / 2;
                const presentH = innerH * (p.present / max);
                const absentH = innerH * (p.absent / max);
                return (
                    <g key={p.label}>
                        <rect
                            x={center - barW - 1.5}
                            y={padT + innerH - presentH}
                            width={barW}
                            height={Math.max(presentH, p.present > 0 ? 2 : 0)}
                            rx={barW / 2}
                            fill={`url(#${presentId})`}
                        >
                            <title>{`${p.label} · present: ${p.present}`}</title>
                        </rect>
                        <rect
                            x={center + 1.5}
                            y={padT + innerH - absentH}
                            width={barW}
                            height={Math.max(absentH, p.absent > 0 ? 2 : 0)}
                            rx={barW / 2}
                            fill={`url(#${absentId})`}
                        >
                            <title>{`${p.label} · absent: ${p.absent}`}</title>
                        </rect>
                        <text
                            x={center}
                            y={padT + innerH + 17}
                            textAnchor="middle"
                            className="fill-slate-400"
                            fontSize="9"
                        >
                            {p.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

export const DashboardCharts: React.FC = () => {
    const { currentUser } = useUniversity();
    const [trends, setTrends] = useState<DashboardTrends | null>(null);
    const [error, setError] = useState<string | null>(null);
    const effective = useMemo(() => {
        const resolved = resolveEffectivePermissions({ role: currentUser?.role });
        const extra = (currentUser?.permissions ?? []) as Permission[];
        return Array.from(new Set([...resolved, ...extra]));
    }, [currentUser?.role, currentUser?.permissions]);

    const canView = hasEffectivePermission(effective, "dashboard.kpi");

    const visibleCards = useMemo(
        () =>
            CHART_CARDS.filter((card) =>
                card.requires.some((p) => hasEffectivePermission(effective, p))
            ),
        [effective]
    );

    useEffect(() => {
        if (!canView || visibleCards.length === 0) return;
        let active = true;
        fetchTrends()
            .then((data) => {
                if (active) setTrends(data);
            })
            .catch(() => {
                if (active) setError("Analytics snapshot unavailable.");
            });
        return () => {
            active = false;
        };
    }, [canView, visibleCards.length]);

    if (!canView || visibleCards.length === 0) return null;

    return (
        <section
            className="mb-6"
            aria-label="University analytics"
        >
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" aria-hidden="true" />
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                        Analytics & Trends
                    </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider border border-slate-200 bg-white rounded-full px-2.5 py-1">
                    <Sparkles className="h-3 w-3 text-indigo-500" aria-hidden="true" />
                    Visual view
                </span>
            </div>

            {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    {error}
                </div>
            ) : !trends ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleCards.map((card) => (
                        <div
                            key={card.key}
                            className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse h-[220px]"
                        />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleCards.map((card) => {
                        const full = card.key === "attendanceWeekly" ? "md:col-span-2" : "";
                        return (
                            <div
                                key={card.key}
                                className={cn(
                                    "rounded-2xl border border-slate-200 bg-white p-5",
                                    full
                                )}
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <span
                                        className={cn(
                                            "h-9 w-9 rounded-xl inline-flex items-center justify-center shrink-0",
                                            card.key === "feesMonthly"
                                                ? FEE_ACCENT.soft
                                                : card.key === "applicationsMonthly"
                                                    ? APP_ACCENT.soft
                                                    : "bg-emerald-50"
                                        )}
                                    >
                                        <card.icon
                                            className={cn(
                                                "h-4.5 w-4.5",
                                                card.key === "feesMonthly"
                                                    ? FEE_ACCENT.text
                                                    : card.key === "applicationsMonthly"
                                                        ? APP_ACCENT.text
                                                        : "text-emerald-600"
                                            )}
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                                            {card.title}
                                        </h3>
                                        <p className="text-[11px] text-slate-500">{card.subtitle}</p>
                                    </div>
                                </div>

                                {card.key === "feesMonthly" &&
                                    (sum(trends.feesMonthly.map((p) => p.value)) === 0 ? (
                                        <EmptyChart />
                                    ) : (
                                        <MiniBarChart
                                            points={trends.feesMonthly}
                                            formatValue={fmtFee}
                                            accent={FEE_ACCENT}
                                            ariaLabel="Fees collected per month"
                                        />
                                    ))}

                                {card.key === "applicationsMonthly" &&
                                    (sum(trends.applicationsMonthly.map((p) => p.value)) === 0 ? (
                                        <EmptyChart />
                                    ) : (
                                        <MiniBarChart
                                            points={trends.applicationsMonthly}
                                            formatValue={fmtCount}
                                            accent={APP_ACCENT}
                                            ariaLabel="New applications per month"
                                        />
                                    ))}

                                {card.key === "attendanceWeekly" &&
                                    (sum(
                                        trends.attendanceWeekly.flatMap((p) => [p.present, p.absent])
                                    ) === 0 ? (
                                        <EmptyChart />
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4 mb-2 text-[11px] font-semibold text-slate-600">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                                                    Present
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                                                    Absent
                                                </span>
                                            </div>
                                            <GroupedBarChart
                                                points={trends.attendanceWeekly}
                                                ariaLabel="Weekly attendance present versus absent"
                                            />
                                        </>
                                    ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

function EmptyChart() {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="h-8 w-8 rounded-full bg-slate-100 inline-flex items-center justify-center mb-2">
                <TrendingUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </span>
            <p className="text-xs text-slate-500">No data yet in this period.</p>
        </div>
    );
}
