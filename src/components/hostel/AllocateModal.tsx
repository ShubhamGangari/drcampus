"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { StudentSelect } from "@/components/hostel/StudentSelect";
import { AllocateInput, HostelRoom } from "@/lib/hostel";

interface AllocateModalProps {
  open: boolean;
  rooms: HostelRoom[];
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: AllocateInput) => void;
}

export function AllocateModal({
  open,
  rooms,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: AllocateModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    studentId?: string;
    roomId?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setStudentId("");
    setRoomId("");
    setFieldErrors({});
  }, [open]);

  const availableRooms = rooms.filter((r) => r.occupied < r.capacity);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!studentId) errors.studentId = "Select a student.";
    if (!roomId) errors.roomId = "Select a room.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      schoolId: schoolRequired ? schoolId : undefined,
      studentId,
      roomId,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Allocate Room"
      description="Assign a room to a student. Rooms at capacity are disabled."
    >
      <div className="px-6 py-5 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <StudentSelect value={studentId} onChange={setStudentId} error={fieldErrors.studentId} />

        <Field label="Room" htmlFor="allocation-room" error={fieldErrors.roomId}>
          <SelectInput
            id="allocation-room"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={busy}
          >
            <option value="">
              {rooms.length === 0 ? "No rooms available" : "Select room"}
            </option>
            {availableRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNo} ({room.occupied}/{room.capacity} occupied)
              </option>
            ))}
          </SelectInput>
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
            disabled={busy || availableRooms.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy ? <InlineLoader label="Allocating…" /> : "Allocate"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
