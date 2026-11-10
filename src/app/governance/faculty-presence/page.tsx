"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, ArrowLeft, CalendarDays } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import {
    fetchFacultyPresence,
    setFacultyPresence,
    lastNDays,
    formatDisplayDate,
    PRESENCE_LABELS,
    canManagePresence,
    type FacultyPresenceView,
    type PresenceStatus,
    type ServerPresenceStatus,
} from "@/lib/governance";
import type { UserRole } from "@/types";

type Toast = { kind: "success" | "error"; message: string } | null;

interface PresenceRow {
    userId: string;
    name: string;
    departmentName: string | null;
    position: string | null;
    statusByDay: Map<string, PresenceStatus>;
}

const DAY_COUNT = 7;

export default function FacultyPresencePage() {
    const [role, setRole] = useState<UserRole | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<PresenceRow[]>([]);
    const [days] = useState<string[]>(() => lastNDays(DAY_COUNT));
    const [toast, setToast] = useState<Toast>(null);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setRole(d?.user?.role))
            .catch(() => setRole(undefined));
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await Promise.all(
                days.map((date) => fetchFacultyPresence({ date }))
            );
            const byUserId = new Map<string, Map<string, PresenceStatus>>();
            const order: string[] = [];
            const meta = new Map<string, Pick<FacultyPresenceView, "name" | "departmentName" | "position">>();

            results.forEach((res, idx) => {
                const date = days[idx];
                for (const item of res.items) {
                    if (!byUserId.has(item.userId)) {
                        byUserId.set(item.userId, new Map());
                        order.push(item.userId);
                    }
                    byUserId.get(item.userId)!.set(date, item.status);
                    if (!meta.has(item.userId)) {
                        meta.set(item.userId, {
                            name: item.name,
                            departmentName: item.departmentName,
                            position: item.position,
                        });
                    }
                }
            });

            setRows(
                order.map((uid) => {
                    const m = meta.get(uid)!;
                    return {
                        userId: uid,
                        name: m.name,
                        departmentName: m.departmentName,
                        position: m.position,
                        statusByDay: byUserId.get(uid)!,
                    };
                })
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load faculty presence");
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        void load();
    }, [load]);

    const canManage = canManagePresence(role);

    const handleCellChange = async (userId: string, date: string, status: ServerPresenceStatus) => {
        const key = `${userId}|${date}`;
        setSavingKey(key);
        try {
            await setFacultyPresence({ userId, date, status });
            setRows((prev) =>
                prev.map((r) => {
                    if (r.userId !== userId) return r;
                    const next = new Map(r.statusByDay);
                    next.set(date, status);
                    return { ...r, statusByDay: next };
                })
            );
            setToast({ kind: "success", message: `${PRESENCE_LABELS[status]} saved for ${formatDisplayDate(date)}` });
        } catch (e) {
            setToast({ kind: "error", message: e instanceof Error ? e.message : "Failed to update presence" });
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <Link href="/governance/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <Users className="h-5 w-5 text-indigo-600" /> Faculty presence
                        </h1>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Daily presence for the last {DAY_COUNT} days
                    </p>
                </div>
                <Link href="/academic/timetable">
                    <Button variant="outline" size="sm">
                        <CalendarDays className="h-4 w-4" /> Timetable
                    </Button>
                </Link>
            </div>

            {toast && (
                <div
                    className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${toast.kind === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-rose-200 bg-rose-50 text-rose-800"
                        }`}
                    role="status"
                >
                    {toast.message}
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Legend:</span>
                {(Object.keys(PRESENCE_LABELS) as PresenceStatus[]).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                        <Badge
                            variant={
                                s === "PRESENT"
                                    ? "success"
                                    : s === "ABSENT"
                                        ? "danger"
                                        : s === "ON_LEAVE"
                                            ? "warning"
                                            : "outline"
                            }
                        >
                            {PRESENCE_LABELS[s]}
                        </Badge>
                    </span>
                ))}
            </div>

            {loading ? (
                <LoadingState rows={5} />
            ) : error ? (
                <ErrorState message={error} retry={() => void load()} />
            ) : rows.length === 0 ? (
                <EmptyState icon={Users} title="No faculty found" />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-indigo-600" /> Daily grid
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="px-5 py-3 min-w-40">Faculty</th>
                                        {days.map((d) => (
                                            <th key={d} className="px-3 py-3 text-center min-w-20">
                                                {formatDisplayDate(d)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {rows.map((r) => (
                                        <tr key={r.userId} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3">
                                                <p className="font-medium text-slate-900">{r.name}</p>
                                                <p className="text-xs text-slate-400">{r.departmentName ?? "—"}</p>
                                            </td>
                                            {days.map((d) => {
                                                const status = r.statusByDay.get(d) ?? "UNMARKED";
                                                const key = `${r.userId}|${d}`;
                                                return (
                                                    <td key={d} className="px-3 py-3 text-center">
                                                        {canManage ? (
                                                            <select
                                                                value={status === "UNMARKED" ? "" : status}
                                                                disabled={savingKey === key}
                                                                onChange={(e) =>
                                                                    handleCellChange(r.userId, d, e.target.value as ServerPresenceStatus)
                                                                }
                                                                className="h-8 w-24 rounded-lg border border-slate-300 bg-white px-1.5 text-xs font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                                                                aria-label={`Status for ${r.name} on ${formatDisplayDate(d)}`}
                                                            >
                                                                <option value="" disabled>
                                                                    —
                                                                </option>
                                                                <option value="PRESENT">Present</option>
                                                                <option value="ABSENT">Absent</option>
                                                                <option value="ON_LEAVE">On leave</option>
                                                            </select>
                                                        ) : (
                                                            <Badge
                                                                variant={
                                                                    status === "PRESENT"
                                                                        ? "success"
                                                                        : status === "ABSENT"
                                                                            ? "danger"
                                                                            : status === "ON_LEAVE"
                                                                                ? "warning"
                                                                                : "outline"
                                                                }
                                                            >
                                                                {PRESENCE_LABELS[status]}
                                                            </Badge>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
