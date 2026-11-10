"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { CreateClassInput } from "@/lib/org-client";
import { PROGRAM_OPTIONS, fetchBatches } from "@/lib/students";

interface ClassCreateModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateClassInput) => void;
}

export function ClassCreateModal({
  open,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: ClassCreateModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [section, setSection] = useState("");
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    programId?: string;
    batchId?: string;
    section?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setProgramId("");
    setBatchId("");
    setSection("");
    setBatches([]);
    setFieldErrors({});
  }, [open]);

  const loadBatches = useCallback(async () => {
    if (!programId) return;
    setBatchesLoading(true);
    try {
      const list = await fetchBatches({ programId });
      setBatches(list);
      setBatchId("");
    } catch {
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!programId) errors.programId = "Select a program.";
    if (!batchId) errors.batchId = "Select a batch.";
    if (!section.trim()) errors.section = "Section is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({ schoolId, programId, batchId, section: section.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create class group"
      description="Add a class group (section) under a program batch."
    >
      <div className="p-6 space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} error={fieldErrors.schoolId} />
        )}

        <Field label="Program" htmlFor="class-program" error={fieldErrors.programId}>
          <SelectInput
            id="class-program"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            disabled={busy}
          >
            <option value="">Select programâ€¦</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Batch" htmlFor="class-batch" error={fieldErrors.batchId}>
          <SelectInput
            id="class-batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            disabled={busy || batchesLoading || !programId}
          >
            <option value="">{batchesLoading ? "Loading batchesâ€¦" : "Select batchâ€¦"}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Section" htmlFor="class-section" error={fieldErrors.section}>
          <TextInput
            id="class-section"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="e.g. A"
            disabled={busy}
          />
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
            Create section
          </button>
        </div>
      </div>
    </Modal>
  );
}
