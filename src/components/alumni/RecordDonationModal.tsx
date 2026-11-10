"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { DONATION_MODES, RecordDonationInput } from "@/lib/alumni";

interface RecordDonationModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: RecordDonationInput) => void;
}

export function RecordDonationModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: RecordDonationModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    amount?: string;
    mode?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setAmount("");
    setMode("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    const numeric = Number(amount);
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!amount || Number.isNaN(numeric) || numeric <= 0) {
      errors.amount = "Enter an amount greater than 0.";
    }
    if (!mode) errors.mode = "Select a payment mode.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      amount: numeric,
      mode,
    });
  };

  return (
    <Modal
      open={open}
      title="Record Donation"
      description="Log a contribution to the alumni fund."
      onClose={busy ? () => undefined : onClose}
    >
      <div className="p-6 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <Field label="Amount (₹)" htmlFor="donation-amount" error={fieldErrors.amount}>
          <TextInput
            id="donation-amount"
            type="number"
            min="1"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 10000"
            disabled={busy}
          />
        </Field>

        <Field label="Mode" htmlFor="donation-mode" error={fieldErrors.mode}>
          <select
            id="donation-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Select mode…</option>
            {DONATION_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <p className="text-[11px] font-medium text-rose-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <InlineLoader label="Saving…" /> : "Record donation"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
