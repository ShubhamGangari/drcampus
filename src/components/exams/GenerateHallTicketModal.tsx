"use client";

import { useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { fullName } from "@/lib/students";
import type { StudentSummary } from "@/lib/students";

interface GenerateHallTicketModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** Students available to generate tickets for (exam's program). */
  students: StudentSummary[];
  onClose: () => void;
  onSubmit: (studentId: string) => void;
}

export function GenerateHallTicketModal({
  open,
  busy,
  error,
  students,
  onClose,
  onSubmit,
}: GenerateHallTicketModalProps) {
  const [studentId, setStudentId] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const close = () => {
    if (busy) return;
    setStudentId("");
    setFieldError(undefined);
    onClose();
  };

  const submit = () => {
    if (!studentId) {
      setFieldError("Select a student to generate a hall ticket for.");
      return;
    }
    onSubmit(studentId);
  };

  return (
    <Modal
      open={open}
      title="Generate Hall Ticket"
      description="Issue a hall ticket for a student in this exam."
      onClose={close}
    >
      <div className="p-6 space-y-4">
        <Field label="Student" htmlFor="ht-student" error={fieldError}>
          <SelectInput
            id="ht-student"
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setFieldError(undefined);
            }}
            disabled={busy}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {fullName(s)} — {s.rollNo}
              </option>
            ))}
          </SelectInput>
          {students.length === 0 && (
            <p className="text-[11px] font-medium text-amber-600 mt-1.5">
              No students found for this examination program.
            </p>
          )}
        </Field>

        {error && (
          <p className="text-xs font-medium text-rose-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {busy ? <InlineLoader label="Generating…" /> : "Generate"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
