"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "primary" | "success" | "danger" | "warning" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  primary: "bg-indigo-50 text-indigo-700",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-rose-50 text-rose-700",
  warning: "bg-amber-50 text-amber-700",
  outline: "bg-white text-slate-600 border border-slate-300",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
