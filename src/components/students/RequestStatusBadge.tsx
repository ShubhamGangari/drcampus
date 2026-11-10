"use client";

import type { RequestReviewStatus } from "@/lib/students";
import { Clock3, CheckCircle2, XCircle } from "lucide-react";

const STATUS_META: Record<RequestReviewStatus, { label: string; className: string; icon: React.ElementType }> = {
  PENDING: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
};

export function RequestStatusBadge({ status }: { status: RequestReviewStatus | string }) {
  const meta = STATUS_META[status as RequestReviewStatus] ?? STATUS_META.PENDING;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}
