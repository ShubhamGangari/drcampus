"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { CreateRoomInput, ROOM_TYPES } from "@/lib/hostel";

interface AddRoomModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateRoomInput) => void;
}

export function AddRoomModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: AddRoomModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [type, setType] = useState("");
  const [capacity, setCapacity] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    roomNo?: string;
    type?: string;
    capacity?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setRoomNo("");
    setType("");
    setCapacity("");
    setFieldErrors({});
  }, [open]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!roomNo.trim()) errors.roomNo = "Room number is required.";
    if (!type) errors.type = "Select a room type.";
    const cap = Number(capacity);
    if (!capacity || !Number.isInteger(cap) || cap < 1) {
      errors.capacity = "Enter a whole number of at least 1.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      roomNo: roomNo.trim(),
      type,
      capacity: cap,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Room"
      description="Create a new hostel room. Room numbers must be unique per school."
    >
      <div className="px-6 py-5 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <Field label="Room Number" htmlFor="room-number" error={fieldErrors.roomNo}>
          <TextInput
            id="room-number"
            value={roomNo}
            onChange={(e) => setRoomNo(e.target.value)}
            placeholder="e.g. R-101"
            disabled={busy}
          />
        </Field>

        <Field label="Type" htmlFor="room-type" error={fieldErrors.type}>
          <SelectInput
            id="room-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={busy}
          >
            <option value="">Select type</option>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Capacity" htmlFor="room-capacity" error={fieldErrors.capacity}>
          <TextInput
            id="room-capacity"
            type="number"
            min={1}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g. 4"
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
            {busy ? <InlineLoader label="Saving…" /> : "Add Room"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
