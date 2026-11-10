"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { PROGRAM_OPTIONS } from "@/lib/students";
import {
  academicYearChoices,
  componentTotal,
  formatAmount,
  SEMESTER_OPTIONS,
  CreateStructureInput,
  FeeComponent,
  FeeStructure,
} from "@/lib/fees";

interface CreateStructureModalProps {
  open: boolean;
  mode: "create" | "edit" | "duplicate";
  initial?: FeeStructure | null;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateStructureInput) => void;
}

interface RowError {
  name?: string;
  amount?: string;
}

export function CreateStructureModal({
  open,
  mode,
  initial,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: CreateStructureModalProps) {
  const showSchool = schoolRequired && mode !== "edit";
  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState("");
  const [components, setComponents] = useState<FeeComponent[]>([{ name: "", amount: 0 }]);
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    programId?: string;
    academicYear?: string;
    semester?: string;
    components?: string;
    rows?: RowError[];
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    if (mode === "create") {
      setProgramId("");
      setAcademicYear("");
      setSemester("");
      setComponents([{ name: "", amount: 0 }]);
    } else if (initial) {
      setProgramId(initial.programId);
      setAcademicYear(initial.academicYear);
      setSemester(String(initial.semester));
      setComponents(
        initial.components.length ? initial.components.map((c) => ({ ...c })) : [{ name: "", amount: 0 }]
      );
    }
    setFieldErrors({});
  }, [open, mode, initial]);

  const total = componentTotal(components);

  const updateRow = (index: number, patch: Partial<FeeComponent>) => {
    setComponents((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    setComponents((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addRow = () => {
    setComponents((prev) => [...prev, { name: "", amount: 0 }]);
  };

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (showSchool && !schoolId) errors.schoolId = "Select a school.";
    if (!programId) errors.programId = "Select a program.";
    if (!academicYear) errors.academicYear = "Select an academic year.";
    if (!semester) errors.semester = "Select a semester.";

    const rows: RowError[] = components.map((row) => {
      const r: RowError = {};
      if (!row.name.trim()) r.name = "Required";
      if (!Number(row.amount) || Number(row.amount) <= 0) r.amount = "Enter amount";
      return r;
    });

    if (components.length === 0 || components.every((c) => !c.name.trim() && !Number(c.amount))) {
      errors.components = "Add at least one fee component.";
    } else if (rows.some((r) => r.name || r.amount)) {
      errors.rows = rows;
    }

    setFieldErrors(errors);
    if (errors.schoolId || errors.programId || errors.academicYear || errors.semester || errors.components || errors.rows) {
      return;
    }

    onSubmit({
      programId,
      academicYear,
      semester: Number(semester),
      components: components.map((c) => ({ name: c.name.trim(), amount: Number(c.amount) })),
      totalAmount: total,
      ...(showSchool ? { schoolId } : {}),
    });
  };

  const title =
    mode === "edit" ? "Edit fee structure" : mode === "duplicate" ? "Duplicate fee structure" : "New fee structure";
  const description =
    mode === "edit"
      ? "Update the components of this fee structure."
      : "Define the fee components billed per student.";

  return (
    <Modal open={open} onClose={() => (busy ? undefined : onClose())} title={title} description={description} wide>
      <div className="space-y-4">
        {showSchool && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} disabled={busy} error={fieldErrors.schoolId} />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Program" htmlFor="fs-program" error={fieldErrors.programId}>
            <SelectInput
              id="fs-program"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select program</option>
              {PROGRAM_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Academic year" htmlFor="fs-year" error={fieldErrors.academicYear}>
            <SelectInput
              id="fs-year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              disabled={busy}
            >
              <option value="">Select year</option>
              {academicYearChoices().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Semester" htmlFor="fs-sem" error={fieldErrors.semester}>
            <SelectInput
              id="fs-sem"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              disabled={busy}
            >
              <option value="">Select semester</option>
              {SEMESTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Fee components</span>
            <button
              type="button"
              onClick={addRow}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add component
            </button>
          </div>

          <div className="space-y-2">
            {components.map((row, index) => {
              const rowErr = fieldErrors.rows?.[index];
              return (
                <div key={index} className="grid grid-cols-[1fr_9rem_2.5rem] gap-2 items-start">
                  <Field label="Name" error={rowErr?.name}>
                    <TextInput
                      value={row.name}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                      placeholder="e.g. Tuition Fee"
                      disabled={busy}
                    />
                  </Field>
                  <Field label="Amount (₹)" error={rowErr?.amount}>
                    <TextInput
                      type="number"
                      min={0}
                      value={row.amount === 0 ? "" : row.amount}
                      onChange={(e) => updateRow(index, { amount: Number(e.target.value) })}
                      placeholder="0"
                      disabled={busy}
                    />
                  </Field>
                  <div className="pt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={busy || components.length === 1}
                      aria-label={`Remove component ${index + 1}`}
                      className="h-9 w-9 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {fieldErrors.components && (
            <p className="text-[11px] font-medium text-rose-600 mt-2" role="alert">
              {fieldErrors.components}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <span className="text-xs font-bold text-slate-500">Total amount</span>
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">{formatAmount(total)}</span>
          </div>
        </div>

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
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? <InlineLoader label={mode === "edit" ? "Saving…" : "Creating…"} /> : mode === "edit" ? "Save changes" : "Create structure"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
