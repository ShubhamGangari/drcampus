"use client";

import { Loader2, Inbox, AlertTriangle, RefreshCw } from "lucide-react";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="h-8 w-8 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Inbox className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-rose-500" />
      </div>
      <h3 className="text-sm font-bold text-slate-900">Something went wrong</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
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

export function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs font-medium text-slate-500">Loading Admissions…</p>
      </div>
    </div>
  );
}

export function InlineLoader({ label = "Working…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}
