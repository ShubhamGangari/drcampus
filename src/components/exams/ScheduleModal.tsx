"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { COURSES } from "@/data/mockData";
import {
  AddScheduleInput,
  ExamSchedule,
  UpdateScheduleInput,
} from "@/lib/exams";

interface ScheduleModalProps {
  open: boolean;
  /** "create" to add a schedule for the selected exam; "edit" to edit an existing one. */
  mode: "create" | "edit";
  /** Existing schedule being edited (create mode passes null). */
  record?: ExamSchedule | null;
  /** Program of the selected exam (used to filter course options). */
  programId: string;
  /** Semester of the selected exam (used to filter course options). */
  semester: number;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  /** create → AddScheduleInput; edit → partial UpdateScheduleInput */
  onSubmit: (input: AddScheduleInput | UpdateScheduleInput, mode: "create" | "edit") => void;
}

interface FieldErrors {
  courseId?: string;
  examDate?: string;
  startTime?: string;
  venue?: string;
}

export function ScheduleModal({
  open,
  mode,
  record,
  programId,
  semester,
  busy,
  error,
  onClose,
  onSubmit,
}: ScheduleModalProps) {
  const courseOptions = COURSES.filter((c) => c.programId === programId && c.semester === semester);

  const [courseId, setCourseId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [venue, setVenue] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // When the modal opens, seed the form from the record (edit) or reset (create).
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && record) {
      setCourseId(record.courseId);
      setExamDate(record.examDate ? record.examDate.slice(0, 10) : "");
      setStartTime(record.startTime || "");
      setVenue(record.venue || "");
    } else {
      setCourseId("");
      setExamDate("");
      setStartTime("");
      setVenue("");
    }
    setFieldErrors({});
  }, [open, mode, record]);

  const close = () => {
    if (busy) return;
    setFieldErrors({});
    onClose();
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (mode === "create" && !courseId) next.courseId = "Course is required.";
    if (!examDate) next.examDate = "Exam date is required.";
    if (!startTime) next.startTime = "Start time is required.";
    if (!venue.trim()) next.venue = "Venue is required.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    if (mode === "create") {
      onSubmit(
        {
          courseId,
          examDate,
          startTime,
          venue: venue.trim(),
        },
        "create"
      );
    } else {
      onSubmit(
        {
          examDate,
          startTime,
          venue: venue.trim(),
        },
        "edit"
      );
    }
  };

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Edit Schedule" : "Add Schedule"}
      description={
        mode === "edit"
          ? "Update the date, time or venue for this course schedule."
          : "Add a course exam schedule to the selected exam."
      }
      onClose={close}
    >
      <div className="p-6 space-y-4">
        {mode === "create" && (
          <Field label="Course" htmlFor="schedule-course" error={fieldErrors.courseId}>
            <SelectInput
              id="schedule-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select course</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </SelectInput>
            {courseOptions.length === 0 && (
              <p className="text-[11px] font-medium text-amber-600 mt-1.5">
                No courses found for this program & semester.
              </p>
            )}
          </Field>
        )}

        {mode === "edit" && record && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <p className="text-xs font-bold text-slate-700">
              {record.courseCode} — {record.courseTitle}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Exam Date" htmlFor="schedule-date" error={fieldErrors.examDate}>
            <TextInput
              id="schedule-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="Start Time" htmlFor="schedule-time" error={fieldErrors.startTime}>
            <TextInput
              id="schedule-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={busy}
            />
          </Field>
        </div>

        <Field label="Venue" htmlFor="schedule-venue" error={fieldErrors.venue}>
          <TextInput
            id="schedule-venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Block B — Hall 204"
            disabled={busy}
          />
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
            {busy ? <InlineLoader label="Saving…" /> : mode === "edit" ? "Save Changes" : "Add Schedule"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
