"use client";

import {
  examStatusLabel,
  examTypeLabel,
  ExamStatus,
  ExamType,
} from "@/lib/exams";

export function ExamTypeBadge({ type }: { type: ExamType }) {
  const mid = type === "MID_SEM";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
        mid
          ? "bg-sky-50 text-sky-700 border-sky-200"
          : "bg-violet-50 text-violet-700 border-violet-200"
      }`}
    >
      {examTypeLabel(type)}
    </span>
  );
}

const STATUS_STYLES: Record<ExamStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  SCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-blue-50 text-blue-700 border-blue-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function ExamStatusBadge({ status }: { status: ExamStatus | string }) {
  const style = STATUS_STYLES[status as ExamStatus] ?? STATUS_STYLES.DRAFT;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${style}`}>
      {examStatusLabel(status)}
    </span>
  );
}

const GRADE_STYLES: Record<string, string> = {
  "A+": "bg-emerald-50 text-emerald-700 border-emerald-200",
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "B+": "bg-sky-50 text-sky-700 border-sky-200",
  B: "bg-sky-50 text-sky-700 border-sky-200",
  C: "bg-amber-50 text-amber-700 border-amber-200",
  D: "bg-orange-50 text-orange-700 border-orange-200",
  F: "bg-rose-50 text-rose-700 border-rose-200",
};

export function GradeBadge({ grade }: { grade: string }) {
  const style = GRADE_STYLES[grade] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${style}`}>
      {grade || "—"}
    </span>
  );
}
