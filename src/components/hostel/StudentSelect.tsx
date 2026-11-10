"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { StudentsApiError, fetchStudents, StudentSummary } from "@/lib/students";

interface StudentSelectProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
  htmlFor?: string;
  placeholder?: string;
  error?: string;
}

/** Build a display label for a student option. */
function studentLabel(s: StudentSummary): string {
  return `${s.firstName} ${s.lastName} · ${s.rollNo}`;
}

/**
 * Student scoped select. Loads the tenant's student list from
 * `GET /api/students` with dedicated loading / error / retry states.
 */
export function StudentSelect({
  value,
  onChange,
  disabled,
  label = "Student",
  htmlFor = "student-select",
  placeholder = "Select student",
  error,
}: StudentSelectProps) {
  const [options, setOptions] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const students = await fetchStudents();
      setOptions(students);
    } catch (e) {
      setLoadError(e instanceof StudentsApiError ? e.message : "Unable to load students.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Field label={label} htmlFor={htmlFor} error={error}>
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-400">
          <InlineLoader label="Loading students…" />
        </div>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-3.5 py-2.5">
          <span className="text-xs font-medium text-rose-700">{loadError}</span>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <SelectInput
          id={htmlFor}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || options.length === 0}
        >
          <option value="">{options.length === 0 ? "No students available" : placeholder}</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {studentLabel(s)}
            </option>
          ))}
        </SelectInput>
      )}
    </Field>
  );
}
