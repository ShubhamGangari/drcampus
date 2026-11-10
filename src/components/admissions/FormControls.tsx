"use client";

import { Info } from "lucide-react";

const FIELD_BASE =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition disabled:bg-slate-50 disabled:text-slate-400";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="flex items-center gap-1 text-[11px] text-slate-400">
          <Info className="h-3 w-3 shrink-0" />
          {hint}
        </p>
      )}
      {error && (
        <p className="text-[11px] font-medium text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${FIELD_BASE} ${className}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select {...rest} className={`${FIELD_BASE} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_0.75rem_center] pr-10 ${className}`}>
      {children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`${FIELD_BASE} min-h-[84px] resize-y ${className}`} />;
}
