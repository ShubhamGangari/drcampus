"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { CreateAlumniInput } from "@/lib/alumni";

interface AddAlumniModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAlumniInput) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddAlumniModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: AddAlumniModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [batch, setBatch] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    studentId?: string;
    email?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setStudentId("");
    setEmail("");
    setPhone("");
    setCurrentCompany("");
    setBatch("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!studentId.trim()) errors.studentId = "Student ID is required.";
    if (!email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      studentId: studentId.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      currentCompany: currentCompany.trim() || undefined,
      batch: batch.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      title="Add Alumni"
      description="Link a graduated student to an alumni record."
      onClose={busy ? () => undefined : onClose}
    >
      <div className="p-6 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <Field label="Student ID" htmlFor="alumni-student-id" error={fieldErrors.studentId} hint="The graduating student this record links to.">
          <TextInput
            id="alumni-student-id"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. stu_1042"
            disabled={busy}
          />
        </Field>

        <Field label="Email" htmlFor="alumni-email" error={fieldErrors.email}>
          <TextInput
            id="alumni-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alumni@example.com"
            disabled={busy}
          />
        </Field>

        <Field label="Phone" htmlFor="alumni-phone">
          <TextInput
            id="alumni-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 98765 43210"
            disabled={busy}
          />
        </Field>

        <Field label="Current company" htmlFor="alumni-company">
          <TextInput
            id="alumni-company"
            value={currentCompany}
            onChange={(e) => setCurrentCompany(e.target.value)}
            placeholder="e.g. Drivion Solutions"
            disabled={busy}
          />
        </Field>

        <Field label="Batch" htmlFor="alumni-batch" hint="Graduation batch/year.">
          <TextInput
            id="alumni-batch"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="e.g. 2025"
            disabled={busy}
          />
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
            {busy ? <InlineLoader label="Saving…" /> : "Add alumni"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
