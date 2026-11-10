"use client";

import { useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextArea } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";

interface ReviewRequestModalProps {
  open: boolean;
  title: string;
  description?: string;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (status: "APPROVED" | "REJECTED", remarks?: string) => void;
}

export function ReviewRequestModal({
  open,
  title,
  description,
  busy,
  error,
  onClose,
  onConfirm,
}: ReviewRequestModalProps) {
  const [remarks, setRemarks] = useState("");

  const handle = (status: "APPROVED" | "REJECTED") => {
    const trimmed = remarks.trim();
    onConfirm(status, trimmed ? trimmed : undefined);
  };

  return (
    <Modal open={open} onClose={() => (busy ? undefined : onClose())} title={title} description={description}>
      <div className="space-y-4">
        <Field label="Remarks (optional)" hint="Add an internal note to the decision.">
          <TextArea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="Optional remarks"
            disabled={busy}
          />
        </Field>

        {error && (
          <p
            className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handle("REJECTED")}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? <InlineLoader label="Saving…" /> : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => handle("APPROVED")}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? <InlineLoader label="Saving…" /> : "Approve"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
