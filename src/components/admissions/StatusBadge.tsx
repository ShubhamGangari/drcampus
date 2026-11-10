"use client";

import { ApplicationStatus } from "@/lib/admissions";
import { CheckCircle2, XCircle, FileText, ListChecks, GraduationCap } from "lucide-react";

const STATUS_META: Record<ApplicationStatus, { label: string; className: string; icon: React.ElementType }> = {
  SUBMITTED: {
    label: "Submitted",
    className: "bg-slate-100 text-slate-700 border-slate-200",
    icon: FileText,
  },
  VERIFIED: {
    label: "Verified",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
  SHORTLISTED: {
    label: "Shortlisted",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: ListChecks,
  },
  ADMITTED: {
    label: "Admitted",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: GraduationCap,
  },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.SUBMITTED;
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
