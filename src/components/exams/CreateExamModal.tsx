"use client";

import { useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { PROGRAM_OPTIONS } from "@/lib/students";
import { academicYearChoices } from "@/lib/fees";
import {
  CreateExamInput,
  EXAM_TYPE_OPTIONS,
  ExamType,
  SEMESTER_OPTIONS,
} from "@/lib/exams";

interface CreateExamModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateExamInput) => void;
}

interface FieldErrors {
  schoolId?: string;
  programId?: string;
  academicYear?: string;
  semester?: string;
  type?: string;
  title?: string;
  maxInternal?: string;
  maxExternal?: string;
}

export function CreateExamModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: CreateExamModalProps) {
  const yearChoices = academicYearChoices();

  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState("");
  const [type, setType] = useState<ExamType | "">("");
  const [title, setTitle] = useState("");
  const [maxInternal, setMaxInternal] = useState("");
  const [maxExternal, setMaxExternal] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const reset = () => {
    setSchoolId("");
    setProgramId("");
    setAcademicYear("");
    setSemester("");
    setType("");
    setTitle("");
    setMaxInternal("");
    setMaxExternal("");
    setFieldErrors({});
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (schoolRequired && !schoolId) next.schoolId = "School is required.";
    if (!programId) next.programId = "Program is required.";
    if (!academicYear) next.academicYear = "Academic year is required.";
    if (!semester) next.semester = "Semester is required.";
    if (!type) next.type = "Exam type is required.";
    if (!title.trim()) next.title = "Title is required.";
    const mi = Number(maxInternal);
    const me = Number(maxExternal);
    if (!maxInternal || Number.isNaN(mi) || mi <= 0) next.maxInternal = "Enter a positive max internal marks.";
    if (!maxExternal || Number.isNaN(me) || me <= 0) next.maxExternal = "Enter a positive max external marks.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      programId,
      academicYear,
      semester: Number(semester),
      type: type as ExamType,
      title: title.trim(),
      maxInternal: Number(maxInternal),
      maxExternal: Number(maxExternal),
    });
  };

  return (
    <Modal
      open={open}
      title="Create Exam"
      description="Define an examination for a program, year and semester."
      onClose={close}
      wide
    >
      <div className="p-6 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Program" htmlFor="exam-program" error={fieldErrors.programId}>
            <SelectInput
              id="exam-program"
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

          <Field label="Academic Year" htmlFor="exam-year" error={fieldErrors.academicYear}>
            <SelectInput
              id="exam-year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              disabled={busy}
            >
              <option value="">Select year</option>
              {yearChoices.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Semester" htmlFor="exam-semester" error={fieldErrors.semester}>
            <SelectInput
              id="exam-semester"
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

          <Field label="Exam Type" htmlFor="exam-type" error={fieldErrors.type}>
            <SelectInput
              id="exam-type"
              value={type}
              onChange={(e) => setType(e.target.value as ExamType)}
              disabled={busy}
            >
              <option value="">Select type</option>
              {EXAM_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field label="Title" htmlFor="exam-title" error={fieldErrors.title}>
          <TextInput
            id="exam-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. End Semester Examination — CSE 2026"
            disabled={busy}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Max Internal Marks" htmlFor="exam-max-internal" error={fieldErrors.maxInternal}>
            <TextInput
              id="exam-max-internal"
              type="number"
              min={1}
              value={maxInternal}
              onChange={(e) => setMaxInternal(e.target.value)}
              placeholder="e.g. 30"
              disabled={busy}
            />
          </Field>
          <Field label="Max External Marks" htmlFor="exam-max-external" error={fieldErrors.maxExternal}>
            <TextInput
              id="exam-max-external"
              type="number"
              min={1}
              value={maxExternal}
              onChange={(e) => setMaxExternal(e.target.value)}
              placeholder="e.g. 70"
              disabled={busy}
            />
          </Field>
        </div>

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
            {busy ? <InlineLoader label="Creating…" /> : "Create Exam"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
