"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Plus, Power, Inbox } from "lucide-react";
import { PageTitle } from "@/components/admissions/AdmissionsShell";
import { Modal } from "@/components/admissions/Modal";
import { Toast } from "@/components/admissions/Toast";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
  AdmissionCycle,
  CreateCycleInput,
  createCycle,
  fetchCycles,
  AdmissionsApiError,
} from "@/lib/admissions";
import { UniversityProvider, useUniversity } from "@/context/UniversityContext";
import { CONSTITUENT_SCHOOLS } from "@/data/mockData";

interface CycleForm {
  title: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  active: boolean;
  schoolId: string;
}

const EMPTY: CycleForm = {
  title: "",
  academicYear: "",
  startDate: "",
  endDate: "",
  active: true,
  schoolId: "",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => {
  const start = CURRENT_YEAR - 1 + i;
  return `${start}-${start + 1}`;
});

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isValid(form: CycleForm, isCentral: boolean): Partial<Record<keyof CycleForm, string>> {
  const errors: Partial<Record<keyof CycleForm, string>> = {};
  if (form.title.trim().length < 3) errors.title = "Title must be at least 3 characters.";
  if (!/^\d{4}-\d{4}$/.test(form.academicYear)) errors.academicYear = "Format: 2026-2027.";
  if (!form.startDate) errors.startDate = "Start date is required.";
  if (!form.endDate) errors.endDate = "End date is required.";
  if (isCentral && !form.schoolId) errors.schoolId = "Select a school.";
  if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
    errors.endDate = "End date must be after start date.";
  }
  return errors;
}

function CyclesPageContent() {
  const { currentUser } = useUniversity();
  const isCentral = !!currentUser?.isCentral || currentUser?.schoolId === "ALL";

  const [cycles, setCycles] = useState<AdmissionCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CycleForm>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CycleForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchCycles();
      setCycles(res.cycles);
    } catch (e) {
      setLoadError(e instanceof AdmissionsApiError ? e.message : "Unable to load admission cycles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    setForm(EMPTY);
    setFieldErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const set = <K extends keyof CycleForm>(key: K, value: CycleForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async () => {
    const errors = isValid(form, isCentral);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: CreateCycleInput = {
        title: form.title.trim(),
        academicYear: form.academicYear,
        startDate: form.startDate,
        endDate: form.endDate,
        active: form.active,
      };
      if (isCentral && form.schoolId) {
        payload.schoolId = form.schoolId;
      }
      await createCycle(payload);
      setModalOpen(false);
      setToast("Admission cycle created successfully.");
      await load();
    } catch (e) {
      setSubmitError(e instanceof AdmissionsApiError ? e.message : "Could not create cycle.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Admission Cycles"
        subtitle="Configure admission cycles and track application volumes per cycle."
        action={
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Cycle
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : cycles.length === 0 ? (
          <EmptyState
            title="No admission cycles yet"
            description="Create your first admission cycle to begin accepting applications."
            action={
              <button
                type="button"
                onClick={openModal}
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                New Cycle
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Cycle</th>
                  <th className="px-5 py-3.5">Academic Year</th>
                  <th className="px-5 py-3.5">Start Date</th>
                  <th className="px-5 py-3.5">End Date</th>
                  <th className="px-5 py-3.5">Applications</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {cycles.map((cycle) => (
                  <tr key={cycle.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                          <CalendarRange className="h-4.5 w-4.5 text-indigo-600" />
                        </div>
                        <span className="font-bold text-slate-900">{cycle.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {cycle.academicYear}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(cycle.startDate)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(cycle.endDate)}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                        <Inbox className="h-3.5 w-3.5 text-slate-400" />
                        {cycle._count?.applications ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                          cycle.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        <Power className="h-3 w-3" />
                        {cycle.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Admission Cycle"
        description="Define a new intake cycle for the current academic year."
      >
        <div className="space-y-4">
          <Field label="Cycle Title" htmlFor="cycle-title" error={fieldErrors.title}>
            <TextInput
              id="cycle-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. UG Admissions 2026"
            />
          </Field>

          <Field label="Academic Year" htmlFor="cycle-year" error={fieldErrors.academicYear}>
            <SelectInput
              id="cycle-year"
              value={form.academicYear}
              onChange={(e) => set("academicYear", e.target.value)}
            >
              <option value="">Select academic year…</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </SelectInput>
          </Field>

          {isCentral && (
            <Field label="School" htmlFor="cycle-school" error={fieldErrors.schoolId}>
              <SelectInput
                id="cycle-school"
                value={form.schoolId}
                onChange={(e) => set("schoolId", e.target.value)}
              >
                <option value="">Select a school…</option>
                {CONSTITUENT_SCHOOLS.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Start Date" htmlFor="cycle-start" error={fieldErrors.startDate}>
              <TextInput
                id="cycle-start"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </Field>
            <Field label="End Date" htmlFor="cycle-end" error={fieldErrors.endDate}>
              <TextInput
                id="cycle-end"
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700">Set cycle active immediately</span>
          </label>

          {submitError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5" role="alert">
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? "Creating…" : "Create Cycle"}
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}

export default function CyclesPage() {
  return (
    <UniversityProvider>
      <CyclesPageContent />
    </UniversityProvider>
  );
}
