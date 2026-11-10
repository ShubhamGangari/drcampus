"use client";

import type { InvoiceStatus } from "@/lib/fees";
import { CircleDollarSign, CircleAlert, CheckCircle2 } from "lucide-react";

const STATUS_META: Record<InvoiceStatus, { label: string; className: string; icon: React.ElementType }> = {
  UNPAID: {
    label: "Unpaid",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: CircleAlert,
  },
  PARTIAL: {
    label: "Partial",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: CircleDollarSign,
  },
  PAID: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.UNPAID;
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
