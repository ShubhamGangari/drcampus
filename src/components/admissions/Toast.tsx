"use client";

import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useEffect } from "react";

export type ToastType = "success" | "error";

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isSuccess = type === "success";

  return (
    <aside
      role="status"
      aria-live="polite"
      className={`fixed top-6 right-4 sm:right-6 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-auto p-4 rounded-2xl shadow-2xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
        isSuccess
          ? "bg-emerald-600 text-white border-emerald-700"
          : "bg-rose-600 text-white border-rose-700"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-5 w-5 text-white shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />
      )}
      <p className="text-sm font-medium leading-snug pr-2">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="p-1 -m-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
