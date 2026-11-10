"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { CreateEventInput } from "@/lib/alumni";

interface CreateEventModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEventInput) => void;
}

export function CreateEventModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: CreateEventModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    title?: string;
    date?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setTitle("");
    setDate("");
    setLocation("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!title.trim()) errors.title = "Event title is required.";
    if (!date) errors.date = "Pick an event date.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      title: title.trim(),
      date,
      location: location.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      title="Create Event"
      description="Add an alumni event for your school."
      onClose={busy ? () => undefined : onClose}
    >
      <div className="p-6 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <Field label="Event title" htmlFor="event-title" error={fieldErrors.title}>
          <TextInput
            id="event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Annual Alumni Meet 2026"
            disabled={busy}
          />
        </Field>

        <Field label="Date" htmlFor="event-date" error={fieldErrors.date}>
          <TextInput
            id="event-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={busy}
          />
        </Field>

        <Field label="Location" htmlFor="event-location">
          <TextInput
            id="event-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Main Auditorium"
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
            {busy ? <InlineLoader label="Creating…" /> : "Create event"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
