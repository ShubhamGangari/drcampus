"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { FeesApiError, fetchSchools, SchoolOption } from "@/lib/fees";

interface SchoolSelectProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
  htmlFor?: string;
  placeholder?: string;
  error?: string;
}

/**
 * School scoped select shown only to Central officers (schoolId "ALL"). Loads the
 * tenant list from `GET /api/fees/schools` with dedicated loading / error / retry
 * states. School-scoped users never render this and rely on their own school.
 */
export function SchoolSelect({
  value,
  onChange,
  disabled,
  label = "School",
  htmlFor = "school-select",
  placeholder = "Select school",
  error,
}: SchoolSelectProps) {
  const [options, setOptions] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const schools = await fetchSchools();
      setOptions(schools);
    } catch (e) {
      setLoadError(e instanceof FeesApiError ? e.message : "Unable to load schools.");
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
          <InlineLoader label="Loading schools…" />
        </div>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
          <span className="text-xs font-medium text-rose-600">{loadError}</span>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1 shrink-0 text-xs font-bold text-rose-700 hover:text-rose-900 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      ) : (
        <SelectInput id={htmlFor} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">{placeholder}</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectInput>
      )}
    </Field>
  );
}
