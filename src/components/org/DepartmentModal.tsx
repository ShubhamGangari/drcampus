"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { CreateDepartmentInput, UpdateDepartmentInput } from "@/lib/org-client";

interface DepartmentModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** "create" shows school select for Central officers; "edit" only renames/recodes. */
  mode: "create" | "edit";
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  initial?: { name: string; code: string };
  onClose: () => void;
  onSubmit: (input: CreateDepartmentInput | UpdateDepartmentInput) => void;
}

export function DepartmentModal({
  open,
  busy,
  error,
  mode,
  schoolRequired,
  initial,
  onClose,
  onSubmit,
}: DepartmentModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    name?: string;
    code?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setName(initial?.name ?? "");
    setCode(initial?.code ?? "");
    setFieldErrors({});
  }, [open, initial]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!name.trim()) errors.name = "Department name is required.";
    if (!code.trim()) errors.code = "Department code is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit(mode === "create" ? { schoolId, name: name.trim(), code: code.trim() } : { name: name.trim(), code: code.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create department" : "Edit department"}
      description={mode === "create" ? "Add a new department under a school." : "Update the department name or code."}
    >
      <div className="p-6 space-y-4">
        {mode === "create" && schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <Field label="Department name" htmlFor="dept-name" error={fieldErrors.name}>
          <TextInput
            id="dept-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Computer Science & Engineering"
            disabled={busy}
          />
        </Field>

        <Field label="Department code" htmlFor="dept-code" error={fieldErrors.code} hint="Unique within the school. e.g. CSE">
          <TextInput
            id="dept-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. CSE"
            disabled={busy}
          />
        </Field>

        {error && <p className="text-xs font-medium text-rose-600" role="alert">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy && <InlineLoader label="" />}
            {mode === "create" ? "Create department" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
