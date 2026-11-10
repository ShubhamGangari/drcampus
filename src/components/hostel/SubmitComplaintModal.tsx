"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput, TextArea } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { COMPLAINT_TYPES, CreateComplaintInput } from "@/lib/hostel";

interface SubmitComplaintModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: CreateComplaintInput) => void;
}

export function SubmitComplaintModal({
  open,
  busy,
  error,
  onClose,
  onSubmit,
}: SubmitComplaintModalProps) {
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    type?: string;
    description?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setType("");
    setDescription("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (!type) errors.type = "Select a complaint type.";
    if (!description.trim()) errors.description = "Describe the complaint.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({ type, description: description.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit Complaint"
      description="File a hostel complaint. Your identity is attached automatically."
    >
      <div className="px-6 py-5 space-y-4">
        <Field label="Type" htmlFor="complaint-type" error={fieldErrors.type}>
          <SelectInput
            id="complaint-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={busy}
          >
            <option value="">Select type</option>
            {COMPLAINT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ")}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Description" htmlFor="complaint-description" error={fieldErrors.description}>
          <TextArea
            id="complaint-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe the issue…"
            disabled={busy}
          />
        </Field>

        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy ? <InlineLoader label="Submitting…" /> : "Submit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
