"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { programCode } from "@/lib/students";
import {
  CourseOutcome,
  CourseOutcomeDraft,
  CourseOutcomeSet,
} from "@/lib/obe";

const EMPTY_DRAFT: CourseOutcomeDraft = { code: "", description: "" };

// -----------------------------------------------------------------------------
// "Attach CO set" / "Add CO" modal (both use the bulk attach endpoint).
// -----------------------------------------------------------------------------
interface CoEditorModalProps {
  open: boolean;
  mode: "attach" | "add";
  course?: CourseOutcomeSet | null;
  busy: boolean;
  error?: string | null;
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: { schoolId?: string; courseId: string; cos: CourseOutcomeDraft[] }) => void;
}

export function CoEditorModal({
  open,
  mode,
  course,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: CoEditorModalProps) {
  const [courseId, setCourseId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<CourseOutcomeDraft[]>([EMPTY_DRAFT]);
  const [fieldErrors, setFieldErrors] = useState<{ courseId?: string; rows?: string }>({});

  useEffect(() => {
    if (open) {
      setCourseId(mode === "add" && course ? course.courseId : "");
      setSchoolId("");
      setRows([EMPTY_DRAFT]);
      setFieldErrors({});
    }
  }, [open, mode, course]);

  const isValid = () => {
    const err: { courseId?: string; rows?: string } = {};
    if (!courseId.trim()) err.courseId = "Course is required.";
    const rowsValid = rows.every(
      (r) => (r.code.trim() && r.description.trim()) || (!r.code.trim() && !r.description.trim())
    );
    const anyFilled = rows.some((r) => r.code.trim() && r.description.trim());
    if (!anyFilled) err.rows = "Add at least one course outcome (code + description).";
    else if (!rowsValid) err.rows = "Each outcome needs both a code and a description.";
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = () => {
    if (!isValid()) return;
    const filled = rows
      .filter((r) => r.code.trim() && r.description.trim())
      .map((r) => ({ code: r.code.trim(), description: r.description.trim() }));
    onSubmit({
      courseId: courseId.trim(),
      cos: filled,
      ...(schoolRequired && schoolId ? { schoolId } : {}),
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      title={mode === "attach" ? "Attach course-outcome set" : `Add CO — ${course?.courseCode ?? ""}`}
      description={
        mode === "attach" ? "Link course outcomes to an existing course." : course ? `${course.courseCode} • ${course.courseTitle}` : undefined
      }
      wide
    >
      <div className="space-y-4">
        {schoolRequired && <SchoolSelect value={schoolId} onChange={setSchoolId} disabled={busy} />}

        <Field label="Course ID" htmlFor="co-course-id" error={fieldErrors.courseId}>
          <TextInput
            id="co-course-id"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            placeholder={mode === "add" ? "Course is pre-selected" : "e.g. crs_CS401"}
            disabled={busy || mode === "add"}
          />
        </Field>

        {mode === "add" && course && course.cos.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-700 mb-1.5">Existing outcomes</p>
            <ul className="space-y-1">
              {course.cos.map((c) => (
                <li key={c.id} className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                  <span className="font-bold text-slate-700">{c.code}</span> — {c.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-700">New outcomes</p>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] gap-2 items-start">
              <Field label="Code" htmlFor={`co-code-${i}`}>
                <TextInput
                  id={`co-code-${i}`}
                  value={row.code}
                  onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, code: e.target.value } : r)))}
                  placeholder="CO1"
                  disabled={busy}
                />
              </Field>
              <Field label="Description" htmlFor={`co-desc-${i}`}>
                <TextInput
                  id={`co-desc-${i}`}
                  value={row.description}
                  onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                  placeholder="Describe the outcome"
                  disabled={busy}
                />
              </Field>
              <button
                type="button"
                onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                disabled={busy || rows.length === 1}
                className="self-end h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40"
                aria-label="Remove outcome"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, EMPTY_DRAFT])}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add another outcome
          </button>
        </div>

        {fieldErrors.rows && (
          <p className="text-[11px] font-medium text-rose-600" role="alert">
            {fieldErrors.rows}
          </p>
        )}
        {error && (
          <p className="text-[11px] font-medium text-rose-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-60">
            {busy ? "Saving…" : mode === "attach" ? "Attach set" : "Add CO"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Edit CO modal (uses the dedicated PUT endpoint).
// -----------------------------------------------------------------------------
interface EditCoModalProps {
  open: boolean;
  course?: CourseOutcomeSet | null;
  co?: CourseOutcome | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: { code?: string; description?: string }) => void;
}

export function EditCoModal({ open, course, co, busy, error, onClose, onSubmit }: EditCoModalProps) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; description?: string }>({});

  useEffect(() => {
    if (open && co) {
      setCode(co.code);
      setDescription(co.description);
      setFieldErrors({});
    }
  }, [open, co]);

  const submit = () => {
    const err: { code?: string; description?: string } = {};
    if (!code.trim()) err.code = "Code is required.";
    if (!description.trim()) err.description = "Description is required.";
    setFieldErrors(err);
    if (Object.keys(err).length) return;
    onSubmit({ code: code.trim(), description: description.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      title={`Edit CO — ${co?.code ?? ""}`}
      description={course ? `${course.courseCode} • ${course.courseTitle}` : undefined}
    >
      <div className="space-y-4">
        <Field label="Code" htmlFor="edit-co-code" error={fieldErrors.code}>
          <TextInput id="edit-co-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Description" htmlFor="edit-co-desc" error={fieldErrors.description}>
          <TextInput id="edit-co-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
        </Field>
        {error && (
          <p className="text-[11px] font-medium text-rose-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-60">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Course card: course header + its CO list with per-row actions.
// -----------------------------------------------------------------------------
interface CourseCardProps {
  course: CourseOutcomeSet;
  isFaculty: boolean;
  onAddCo: () => void;
  onEditCo: (co: CourseOutcome) => void;
}

export function CourseCard({ course, isFaculty, onAddCo, onEditCo }: CourseCardProps) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900">{course.courseCode}</span>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">
              {programCode(course.programId)}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{course.courseTitle}</p>
        </div>
        {isFaculty && (
          <button
            type="button"
            onClick={onAddCo}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-indigo-600 border border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add CO
          </button>
        )}
      </div>
      <div>
        {course.cos.length === 0 ? (
          <p className="text-xs text-slate-400 px-5 py-4">No course outcomes defined yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {course.cos.map((co) => (
              <li key={co.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <span className="text-xs font-black text-slate-800">{co.code}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{co.description}</p>
                </div>
                {isFaculty && (
                  <button
                    type="button"
                    onClick={() => onEditCo(co)}
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                    aria-label={`Edit ${co.code}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
