"use client";

import { useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import {
    CERTIFICATE_TYPES,
    CERTIFICATE_TYPE_LABELS,
    CreateCertificateInput,
} from "@/lib/certificates";

interface NewCertificateRequestModalProps {
    open: boolean;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (input: CreateCertificateInput) => void;
}

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function NewCertificateRequestModal({
    open,
    busy,
    error,
    onClose,
    onSubmit,
}: NewCertificateRequestModalProps) {
    const [type, setType] = useState<CreateCertificateInput["type"]>("TC");
    const [purpose, setPurpose] = useState("");

    if (!open) return null;

    const canSubmit = !!type;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
            type,
            purpose: purpose.trim() || undefined,
        });
    };

    return (
        <Modal
            open={open}
            title="Request a certificate"
            description="Choose the document type and add a purpose (optional)."
            onClose={onClose}
        >
            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label htmlFor="cert-type" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Certificate type
                    </label>
                    <select
                        id="cert-type"
                        value={type}
                        onChange={(e) => setType(e.target.value as CreateCertificateInput["type"])}
                        className={inputCls}
                    >
                        {CERTIFICATE_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {CERTIFICATE_TYPE_LABELS[t]}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="cert-purpose" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Purpose (optional)
                    </label>
                    <textarea
                        id="cert-purpose"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        rows={3}
                        placeholder="e.g. Higher studies application"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                </div>

                {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 h-10 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !canSubmit}
                        className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {busy ? "Submitting…" : "Request certificate"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
