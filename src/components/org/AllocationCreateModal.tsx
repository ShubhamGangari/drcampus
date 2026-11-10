"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { DepartmentListItem, SEMESTER_OPTIONS, StaffMember } from "@/lib/org-client";

interface Option {
  id: string;
  label: string;
}

interface AllocationCreateModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  courses: Option[];
  classes: Option[];
  faculty: StaffMember[];
  departments: DepartmentListItem[];
  onClose: () => void;
  onSubmit: (input: {
    courseId: string;
    classGroupId: string;
    facultyUserId: string;
    semester: number;
    academicYear: string;
    departmentId?: string;
  }) => void;
}

export function AllocationCreateModal({
  open,
  busy,
  error,
  courses,
  classes,
  faculty,
  departments,
  onClose,
  onSubmit,
}: AllocationCreateModalProps) {
  const [courseId, setCourseId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [facultyUserId, setFacultyUserId] = useState("");
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    courseId?: string;
    classGroupId?: string;
    facultyUserId?: string;
    semester?: string;
    academicYear?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setCourseId("");
    setClassGroupId("");
    setFacultyUserId("");
    setSemester("");
    setAcademicYear("");
    setDepartmentId("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (!courseId) errors.courseId = "Select a course.";
    if (!classGroupId) errors.classGroupId = "Select a class group.";
    if (!facultyUserId) errors.facultyUserId = "Select a faculty member.";
    if (!semester) errors.semester = "Select a semester.";
    if (!academicYear.trim()) errors.academicYear = "Academic year is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      courseId,
      classGroupId,
      facultyUserId,
      semester: Number(semester),
      academicYear: academicYear.trim(),
      departmentId: departmentId || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Allocate course to faculty"
      description="Assign a faculty member to teach a course to a class group in a semester."
      wide
    >
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Course" htmlFor="alloc-course" error={fieldErrors.courseId}>
            <SelectInput
              id="alloc-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select courseâ€¦</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Class group" htmlFor="alloc-class" error={fieldErrors.classGroupId}>
            <SelectInput
              id="alloc-class"
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select classâ€¦</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Faculty" htmlFor="alloc-faculty" error={fieldErrors.facultyUserId}>
            <SelectInput
              id="alloc-faculty"
              value={facultyUserId}
              onChange={(e) => setFacultyUserId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select facultyâ€¦</option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} Â· {f.email}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Semester" htmlFor="alloc-semester" error={fieldErrors.semester}>
            <SelectInput
              id="alloc-semester"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              disabled={busy}
            >
              <option value="">Select semesterâ€¦</option>
              {SEMESTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Academic year" htmlFor="alloc-year" error={fieldErrors.academicYear}>
            <TextInput
              id="alloc-year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="e.g. 2025-26"
              disabled={busy}
            />
          </Field>

          <Field label="Department (optional)" htmlFor="alloc-dept">
            <SelectInput
              id="alloc-dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={busy}
            >
              <option value="">Auto / none</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
            <p className="text-xs font-semibold text-rose-700" role="alert">{error}</p>
          </div>
        )}

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
            Allocate course
          </button>
        </div>
      </div>
    </Modal>
  );
}
