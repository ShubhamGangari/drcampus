"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { programCode } from "@/lib/students";
import { ExamsApiError, Exam, fetchExams } from "@/lib/exams";

interface ExamPickerProps {
  value: string;
  onChange: (examId: string) => void;
  disabled?: boolean;
  label?: string;
  htmlFor?: string;
  error?: string;
}

/**
 * Exam selector for the schedules / hall-tickets / marks-entry / results screens.
 * Loads the exam list from `GET /api/exams` with dedicated loading / error / retry
 * states. When no exams exist it renders an inline hint instead of an empty select.
 */
export function ExamPicker({
  value,
  onChange,
  disabled,
  label = "Exam",
  htmlFor = "exam-picker",
  error,
}: ExamPickerProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchExams();
      setExams(list);
    } catch (e) {
      setLoadError(e instanceof ExamsApiError ? e.message : "Unable to load exams.");
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
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-500">
          <InlineLoader label="Loading exams…" />
        </div>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
          <span className="text-xs font-medium text-rose-600">{loadError}</span>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          No exams yet — create one on the Exams screen first.
        </div>
      ) : (
        <SelectInput
          id={htmlFor}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select exam</option>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.title} — {programCode(exam.programId)} · Sem {exam.semester} · {exam.academicYear}
            </option>
          ))}
        </SelectInput>
      )}
    </Field>
  );
}
