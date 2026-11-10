"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { StaffMember } from "@/lib/org-client";

interface SetHeadModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** Candidate staff eligible to be the department head. */
  candidates: StaffMember[];
  currentHeadId: string | null;
  onClose: () => void;
  onSubmit: (headUserId: string | null) => void;
}

export function SetHeadModal({
  open,
  busy,
  error,
  candidates,
  currentHeadId,
  onClose,
  onSubmit,
}: SetHeadModalProps) {
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSelected(currentHeadId ?? "");
  }, [open, currentHeadId]);

  const handleSubmit = () => {
    onSubmit(selected === "" ? null : selected);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set department head"
      description="Assign an HOD for this department, or clear the current head."
    >
      <div className="p-6 space-y-4">
        <Field label="Head of Department (HOD)" htmlFor="hod-select">
          <SelectInput
            id="hod-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
          >
            <option value="">â€” No head â€”</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} Â· {c.email}
              </option>
            ))}
          </SelectInput>
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
            Save head
          </button>
        </div>
      </div>
    </Modal>
  );
}
