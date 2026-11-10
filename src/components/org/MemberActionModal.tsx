"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { DepartmentListItem, POSITION_OPTIONS, StaffMember } from "@/lib/org-client";

interface MemberActionModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** "position" changes a member's position; "move" reassigns their department. */
  mode: "position" | "move";
  member: StaffMember | null;
  departments: DepartmentListItem[];
  /** Only used when mode === "position": the current position value. */
  currentPosition?: string | null;
  onClose: () => void;
  onSubmit: (payload: { position?: string; departmentId?: string }) => void;
}

export function MemberActionModal({
  open,
  busy,
  error,
  mode,
  member,
  departments,
  currentPosition,
  onClose,
  onSubmit,
}: MemberActionModalProps) {
  const [position, setPosition] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    position?: string;
    departmentId?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setPosition(currentPosition ?? "");
    setDepartmentId("");
    setFieldErrors({});
  }, [open, currentPosition]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (mode === "position" && !position) errors.position = "Select a position.";
    if (mode === "move" && !departmentId) errors.departmentId = "Select a target department.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit(mode === "position" ? { position } : { departmentId });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "position" ? "Change member position" : "Move member to department"}
      description={
        mode === "position"
          ? `Update the position for ${member?.name ?? "this member"}.`
          : `Reassign ${member?.name ?? "this member"} to a different department.`
      }
    >
      <div className="p-6 space-y-4">
        {mode === "position" ? (
          <Field label="Position" htmlFor="member-position" error={fieldErrors.position}>
            <SelectInput
              id="member-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={busy}
            >
              <option value="">Select positionâ€¦</option>
              {POSITION_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : (
          <Field label="Target department" htmlFor="member-dept" error={fieldErrors.departmentId}>
            <SelectInput
              id="member-dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select departmentâ€¦</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </SelectInput>
          </Field>
        )}

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
            {mode === "position" ? "Save position" : "Move member"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
