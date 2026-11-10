"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { StaffMember } from "@/lib/org-client";

interface SetCoordinatorModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  title: string;
  description?: string;
  /** Candidate staff eligible to be coordinator. */
  candidates: StaffMember[];
  currentCoordinatorId: string | null;
  onClose: () => void;
  onSubmit: (coordinatorUserId: string) => void;
}

export function SetCoordinatorModal({
  open,
  busy,
  error,
  title,
  description,
  candidates,
  currentCoordinatorId,
  onClose,
  onSubmit,
}: SetCoordinatorModalProps) {
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSelected(currentCoordinatorId ?? "");
  }, [open, currentCoordinatorId]);

  const handleSubmit = () => {
    if (!selected) return;
    onSubmit(selected);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
    >
      <div className="p-6 space-y-4">
        <Field label="Coordinator" htmlFor="coord-select">
          <SelectInput
            id="coord-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
          >
            <option value="">Select coordinatorâ€¦</option>
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
            disabled={busy || !selected}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy && <InlineLoader label="" />}
            Set coordinator
          </button>
        </div>
      </div>
    </Modal>
  );
}
