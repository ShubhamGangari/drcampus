"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { CreateEmployeeInput } from "@/lib/hr";

interface AddEmployeeModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEmployeeInput) => void;
}

const DESIGNATIONS = [
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Lecturer",
  "Lab Instructor",
  "Administrative Officer",
  "Accountant",
  "Librarian",
] as const;

export function AddEmployeeModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: AddEmployeeModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    employeeId?: string;
    name?: string;
    designation?: string;
    department?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setEmployeeId("");
    setName("");
    setDesignation("");
    setDepartment("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!employeeId.trim()) errors.employeeId = "Employee ID is required.";
    if (!name.trim()) errors.name = "Employee name is required.";
    if (!designation) errors.designation = "Select a designation.";
    if (!department.trim()) errors.department = "Department is required.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      employeeId: employeeId.trim(),
      name: name.trim(),
      designation,
      department: department.trim(),
    });
  };

  return (
    <Modal
      open={open}
      title="Add Employee"
      description="Create a new employee record under this school."
      onClose={busy ? () => undefined : onClose}
    >
      <div className="p-6 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <Field label="Employee ID" htmlFor="emp-id" error={fieldErrors.employeeId}>
          <TextInput
            id="emp-id"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. EMP-1001"
            disabled={busy}
          />
        </Field>

        <Field label="Full name" htmlFor="emp-name" error={fieldErrors.name}>
          <TextInput
            id="emp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ananya Sharma"
            disabled={busy}
          />
        </Field>

        <Field label="Designation" htmlFor="emp-designation" error={fieldErrors.designation}>
          <select
            id="emp-designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Select designation…</option>
            {DESIGNATIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Department" htmlFor="emp-department" error={fieldErrors.department}>
          <TextInput
            id="emp-department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Computer Science"
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
            {busy ? <InlineLoader label="Saving…" /> : "Add employee"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
