"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/admissions/Modal";
import { InlineLoader } from "@/components/admissions/States";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/**
 * Generic confirmation modal used for destructive / blocking actions in the Admin
 * Console (role deletion, officer deactivation). Renders a danger-styled confirm
 * button and disables both actions while `busy`.
 */
export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = true,
    busy = false,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    return (
        <Modal open={open} onClose={() => (busy ? undefined : onClose())} title={title}>
            <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                        }`}>
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed pt-1">{description}</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
                            }`}
                    >
                        {busy ? <InlineLoader label="Working…" /> : confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
