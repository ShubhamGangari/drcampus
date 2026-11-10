"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { StudentSelect } from "@/components/hostel/StudentSelect";
import { CreateMessBillInput } from "@/lib/hostel";

interface AddBillModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateMessBillInput) => void;
}

export function AddBillModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: AddBillModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [month, setMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    studentId?: string;
    month?: string;
    amount?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setStudentId("");
    setMonth("");
    setAmount("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!studentId) errors.studentId = "Select a student.";
    if (!month) errors.month = "Select a month.";
    const amt = Number(amount);
    if (!amount || !Number.isFinite(amt) || amt <= 0) {
      errors.amount = "Enter an amount greater than 0.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      studentId,
      month,
      amount: amt,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Mess Bill"
      description="Create a mess bill for a student for a given month. Duplicate student+month is rejected."
    >
      <div className="px-6 py-5 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <StudentSelect value={studentId} onChange={setStudentId} error={fieldErrors.studentId} />

        <Field label="Month" htmlFor="bill-month" error={fieldErrors.month}>
          <TextInput
            id="bill-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={busy}
          />
        </Field>

        <Field label="Amount (₹)" htmlFor="bill-amount" error={fieldErrors.amount}>
          <TextInput
            id="bill-amount"
            type="number"
            min={1}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 4500"
            disabled={busy}
          />
        </Field>

        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy ? <InlineLoader label="Saving…" /> : "Add Bill"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
