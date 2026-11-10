"use client";

import type { StudentStatus } from "@/lib/students";
import { UserCheck, CalendarClock, GraduationCap, UserX, ArrowRightLeft } from "lucide-react";

const STATUS_META: Record<StudentStatus, { label: string; className: string; icon: React.ElementType }> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: UserCheck,
  },
  ON_LEAVE: {
    label: "On Leave",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: CalendarClock,
  },
  GRADUATED: {
    label: "Graduated",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: GraduationCap,
  },
  DROPPED: {
    label: "Dropped",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: UserX,
  },
  TRANSFERRED: {
    label: "Transferred",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    icon: ArrowRightLeft,
  },
};

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.ACTIVE;
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
