"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Loader2,
    Search,
    ShieldAlert,
    Clock,
    ChevronDown,
} from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { fetchAuditLogs, AuditLogRow } from "@/lib/cross";
import { cn } from "@/lib/cn";

const ACTION_COLOR: Record<string, string> = {
    STUDENT_CREATED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    STUDENT_UPDATED: "bg-sky-50 text-sky-700 border-sky-200",
    STUDENT_ENROLLED: "bg-cyan-50 text-cyan-700 border-cyan-200",
    STUDENT_GRADUATED: "bg-violet-50 text-violet-700 border-violet-200",
    LEAVE_REQUEST_REVIEWED: "bg-amber-50 text-amber-700 border-amber-200",
    TRANSFER_REQUEST_REVIEWED: "bg-orange-50 text-orange-700 border-orange-200",
    PAYMENT_RECORDED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    EXAM_PUBLISHED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    EXAM_UNPUBLISHED: "bg-slate-100 text-slate-700 border-slate-200",
    ATTENDANCE_MARKED: "bg-blue-50 text-blue-700 border-blue-200",
};

const ENTITY_TYPES = [
    "STUDENT",
    "ENROLLMENT",
    "PAYMENT",
    "EXAM",
    "ATTENDANCE",
    "LEAVE_REQUEST",
    "TRANSFER_REQUEST",
];

function formatAction(action: string): string {
    return action
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function AuditLogsPage() {
    const { currentUser } = useUniversity();
    const canView = currentUser?.permissions?.includes("audit.view") ?? false;

    const [logs, setLogs] = useState<AuditLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [q, setQ] = useState("");
    const [entityType, setEntityType] = useState<string>("");

    const filters = useMemo(
        () => ({
            q: q.trim() || undefined,
            entityType: entityType || undefined,
            limit: 25,
        }),
        [q, entityType],
    );

    useEffect(() => {
        if (!canView) return;
        let active = true;
        setLoading(true);
        setError(null);
        fetchAuditLogs(filters)
            .then((res) => {
                if (!active) return;
                setLogs(res.logs);
                setNextCursor(res.nextCursor);
            })
            .catch(() => {
                if (active) setError("Could not load the audit log.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [canView, filters]);

    const loadMore = async () => {
        if (!nextCursor) return;
        setLoadingMore(true);
        try {
            const res = await fetchAuditLogs({ ...filters, cursor: nextCursor });
            setLogs((prev) => [...prev, ...res.logs]);
            setNextCursor(res.nextCursor);
        } catch {
            /* keep current list */
        } finally {
            setLoadingMore(false);
        }
    };

    if (!canView) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center p-8 rounded-2xl border border-slate-200 bg-white shadow-xs">
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <ShieldAlert className="h-6 w-6 text-slate-500" />
                    </div>
                    <h1 className="text-base font-bold text-slate-900 tracking-tight">
                        Access Restricted
                    </h1>
                    <p className="text-sm text-slate-500 mt-1.5">
                        Only Registrar / Central Administration can view the audit trail.
                    </p>
                    <Link
                        href="/"
                        className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                Audit Log
                            </h1>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                Tenant-scoped
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Immutable trail of administrative actions across the university.
                        </p>
                    </div>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Dashboard
                    </Link>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 mb-5 flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Search action or summary…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={entityType}
                            onChange={(e) => setEntityType(e.target.value)}
                            className="appearance-none bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-xl pl-3.5 pr-8 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                        >
                            <option value="">All entity types</option>
                            {ENTITY_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                </div>

                {/* Log table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-xs">Loading audit trail…</span>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="py-14 text-center text-sm text-rose-600">{error}</div>
                    )}

                    {!loading && !error && logs.length === 0 && (
                        <div className="py-16 text-center">
                            <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                                <Clock className="h-5 w-5 text-slate-400" />
                            </div>
                            <p className="text-sm font-semibold text-slate-600">No audit entries found</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Try broadening your filters.
                            </p>
                        </div>
                    )}

                    {!loading && !error && logs.length > 0 && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                                        <tr>
                                            <th className="px-4 py-3">Action</th>
                                            <th className="px-4 py-3">Summary</th>
                                            <th className="px-4 py-3">Actor</th>
                                            <th className="px-4 py-3">Entity</th>
                                            <th className="px-4 py-3">When</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {logs.map((row) => (
                                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={cn(
                                                            "inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold",
                                                            ACTION_COLOR[row.action] ?? "bg-slate-100 text-slate-700 border-slate-200",
                                                        )}
                                                    >
                                                        {formatAction(row.action)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 max-w-md">
                                                    <p className="truncate">{row.summary}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-slate-900">{row.actorName}</p>
                                                    <p className="text-[10px] text-slate-400">{row.actorRole}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-mono text-[10px] text-slate-500">
                                                        {row.entityType}
                                                    </p>
                                                    <p className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                                                        {row.entityId}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                                    {formatTime(row.createdAt)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {nextCursor && (
                                <div className="px-4 py-3 border-t border-slate-200 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        {loadingMore ? "Loading…" : "Load more"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
