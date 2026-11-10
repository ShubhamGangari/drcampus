"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { ApplyLeaveInput, LEAVE_TYPES } from "@/lib/hr";

interface ApplyLeaveModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: ApplyLeaveInput) => void;
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ApplyLeaveModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: ApplyLeaveModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [type, setType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    type?: string;
    fromDate?: string;
    toDate?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setType("");
    setFromDate("");
    setToDate("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!type) errors.type = "Select a leave type.";
    if (!fromDate) errors.fromDate = "From date is required.";
    if (!toDate) errors.toDate = "To date is required.";
    if (fromDate && toDate && fromDate > toDate) {
      errors.toDate = "To date cannot be before from date.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      type,
      fromDate,
      toDate,
    });
  };

  return (
    <Modal
      open={open}
      title="Apply Leave"
      description="Submit a leave request. The employee is linked from your profile."
      onClose={busy ? () => undefined : onClose}
    >
      <div className="p-6 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <Field label="Leave type" htmlFor="leave-type" error={fieldErrors.type}>
          <select
            id="leave-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Select type…</option>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="From date" htmlFor="leave-from" error={fieldErrors.fromDate}>
            <input
              id="leave-from"
              type="date"
              value={fromDate}
              max={toDateInputValue(new Date(Date.now() + 86400000 * 365))}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition disabled:bg-slate-50 disabled:text-slate-400"
            />
          </Field>

          <Field label="To date" htmlFor="leave-to" error={fieldErrors.toDate}>
            <input
              id="leave-to"
              type="date"
              value={toDate}
              max={toDateInputValue(new Date(Date.now() + 86400000 * 365))}
              onChange={(e) => setToDate(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition disabled:bg-slate-50 disabled:text-slate-400"
            />
          </Field>
        </div>

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
            {busy ? <InlineLoader label="Submitting…" /> : "Apply for leave"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
