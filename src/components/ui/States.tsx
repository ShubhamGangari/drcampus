"use client";

import React from "react";
import Link from "next/link";
import { Inbox, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";

// ==============================================================================
// Shared state components (UX polish spec §3.1).
//
// Purely presentational — no business logic, no data fetching. Used by every
// module shell/page so no screen shows a bare spinner, blank table, or raw error
// text. Exported from `@/components/ui`.
// ==============================================================================

/** Consistent skeleton row for lists/tables while fetching. */
export function LoadingState({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3" role="status" aria-label="Loading">
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="h-14 rounded-xl bg-slate-100 animate-pulse"
                    aria-hidden="true"
                />
            ))}
        </div>
    );
}

/** Consistent error panel with an optional retry action. */
export function ErrorState({
    message = "Something went wrong while loading. Please try again.",
    retry,
}: {
    message?: string;
    retry?: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-14 px-6">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-rose-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Something went wrong</h3>
            {message && <p className="text-xs text-slate-500 mt-1 max-w-sm">{message}</p>}
            {retry && (
                <button
                    type="button"
                    onClick={retry}
                    className="mt-5 inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                </button>
            )}
        </div>
    );
}

/** Guided empty state with an optional primary call-to-action button or link. */
export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    actionHref,
    actionLabel = "Get started",
}: {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    action?: React.ReactNode;
    actionHref?: string;
    actionLabel?: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-14 px-6">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Icon className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
            {(action || actionHref) && (
                <div className="mt-5">
                    {action ? (
                        action
                    ) : (
                        <Link
                            href={actionHref!}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                        >
                            {actionLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
