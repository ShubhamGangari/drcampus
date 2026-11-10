"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  FileText,
  ShieldCheck,
  Loader2,
  Info,
} from "lucide-react";
import { PageTitle } from "@/components/admissions/AdmissionsShell";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { EmptyState } from "@/components/admissions/States";
import {
  PublicAdmissionCycle,
  ApplicantDocument,
  fetchPublicCycles,
  submitApplication,
  AdmissionsApiError,
} from "@/lib/admissions";
import { CONSTITUENT_SCHOOLS, PROGRAMS } from "@/data/mockData";

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const CATEGORY_OPTIONS = ["GENERAL", "OBC", "SC", "ST", "EWS"];

type StepKey = "personal" | "academic" | "documents" | "preview";

interface PersonalState {
  applicantName: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
}

interface AcademicState {
  schoolId: string;
  cycleId: string;
  programId: string;
  category: string;
  marksPercentage: string;
}

interface StepErrors {
  personal: Partial<Record<keyof PersonalState, string>>;
  academic: Partial<Record<keyof AcademicState, string>>;
  documents: string[];
}

const STEPS: { key: StepKey; label: string }[] = [
  { key: "personal", label: "Personal" },
  { key: "academic", label: "Academic" },
  { key: "documents", label: "Documents" },
  { key: "preview", label: "Preview" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{10,15}$/;

export default function ApplyPage() {
  const [stepIndex, setStepIndex] = useState(0);

  const [personal, setPersonal] = useState<PersonalState>({
    applicantName: "",
    email: "",
    phone: "",
    gender: "",
    dob: "",
  });
  const [academic, setAcademic] = useState<AcademicState>({
    schoolId: CONSTITUENT_SCHOOLS[0]?.id ?? "",
    cycleId: "",
    programId: "",
    category: "",
    marksPercentage: "",
  });
  const [documents, setDocuments] = useState<ApplicantDocument[]>([{ name: "", url: "" }]);

  const [errors, setErrors] = useState<StepErrors>({ personal: {}, academic: {}, documents: [] });

  const [cycles, setCycles] = useState<PublicAdmissionCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [cyclesError, setCyclesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ applicationNo: string; status: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCycles() {
      setCyclesLoading(true);
      setCyclesError(null);
      // The public cycles endpoint is tenant-scoped by schoolId, so pass the
      // selected school (falling back to the first constituent school, or a
      // known engineering-school code as a final sensible default).
      const schoolId =
        academic.schoolId || CONSTITUENT_SCHOOLS[0]?.id || "sch_eng";
      try {
        const res = await fetchPublicCycles(schoolId);
        if (!cancelled) setCycles(res.cycles);
      } catch (e) {
        if (!cancelled) {
          setCyclesError(
            e instanceof AdmissionsApiError ? e.message : "Unable to load admission cycles."
          );
        }
      } finally {
        if (!cancelled) setCyclesLoading(false);
      }
    }
    loadCycles();
    return () => {
      cancelled = true;
    };
  }, [academic.schoolId]);

  const programsForSchool = PROGRAMS.filter((p) => p.schoolId === academic.schoolId);

  const validatePersonal = (): boolean => {
    const e: Partial<Record<keyof PersonalState, string>> = {};
    if (personal.applicantName.trim().length < 2) e.applicantName = "Full name is required.";
    if (!EMAIL_RE.test(personal.email)) e.email = "Enter a valid email address.";
    if (!PHONE_RE.test(personal.phone)) e.phone = "Enter a valid phone number (10+ digits).";
    if (!personal.gender) e.gender = "Select a gender.";
    if (!personal.dob) {
      e.dob = "Date of birth is required.";
    } else {
      const d = new Date(personal.dob);
      if (Number.isNaN(d.getTime())) e.dob = "Invalid date.";
      else if (d > new Date()) e.dob = "Date of birth cannot be in the future.";
    }
    setErrors((prev) => ({ ...prev, personal: e }));
    return Object.keys(e).length === 0;
  };

  const validateAcademic = (): boolean => {
    const e: Partial<Record<keyof AcademicState, string>> = {};
    if (!academic.schoolId) e.schoolId = "Select a school.";
    if (!academic.cycleId) e.cycleId = "Select an admission cycle.";
    if (!academic.programId) e.programId = "Select a program.";
    if (!academic.category) e.category = "Select a category.";
    const marks = Number(academic.marksPercentage);
    if (academic.marksPercentage === "" || Number.isNaN(marks)) {
      e.marksPercentage = "Enter your qualifying marks percentage.";
    } else if (marks < 0 || marks > 100) {
      e.marksPercentage = "Marks percentage must be between 0 and 100.";
    }
    setErrors((prev) => ({ ...prev, academic: e }));
    return Object.keys(e).length === 0;
  };

  const validateDocuments = (): boolean => {
    const e = documents.map((doc) => {
      if (!doc.name.trim()) return "Document name is required.";
      let urlOk = false;
      try {
        const u = new URL(doc.url);
        urlOk = u.protocol === "http:" || u.protocol === "https:";
      } catch {
        urlOk = false;
      }
      return urlOk ? "" : "Enter a valid https:// URL.";
    });
    setErrors((prev) => ({ ...prev, documents: e }));
    return e.every((msg) => msg === "");
  };

  const goNext = () => {
    const current = STEPS[stepIndex].key;
    if (current === "personal" && !validatePersonal()) return;
    if (current === "academic" && !validateAcademic()) return;
    if (current === "documents" && !validateDocuments()) return;
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitApplication({
        schoolId: academic.schoolId,
        cycleId: academic.cycleId,
        programId: academic.programId,
        applicantName: personal.applicantName.trim(),
        email: personal.email.trim(),
        phone: personal.phone.trim(),
        gender: personal.gender,
        dob: personal.dob,
        category: academic.category,
        marksPercentage: Number(academic.marksPercentage),
        documents: documents.filter((d) => d.name.trim() && d.url.trim()),
      });
      setConfirmation({ applicationNo: res.application.applicationNo, status: res.application.status });
    } catch (e) {
      setSubmitError(
        e instanceof AdmissionsApiError
          ? e.message
          : "Could not submit your application. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateDoc = (index: number, patch: Partial<ApplicantDocument>) => {
    setDocuments((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setErrors((prev) => {
      const docs = [...prev.documents];
      docs[index] = "";
      return { ...prev, documents: docs };
    });
  };

  if (confirmation) {
    return (
      <>
        <PageTitle title="Application Submitted" />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-lg mx-auto text-center">
          <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Thank you for applying!</h2>
          <p className="text-sm text-slate-500 mt-2">
            Your application has been received and is under review.
          </p>
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Application Number</p>
            <p className="font-mono text-2xl font-bold text-indigo-700 mt-1">
              {confirmation.applicationNo}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Status: <span className="font-semibold text-slate-700">{confirmation.status}</span>
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-5">
            Keep this application number for future reference. You will be notified of the next steps.
          </p>
        </div>
      </>
    );
  }

  const selectedCycle = cycles.find((c) => c.id === academic.cycleId);

  return (
    <>
      <PageTitle
        title="Undergraduate & Postgraduate Admission"
        subtitle="Apply online in four short steps. Indicative, no payment required."
      />

      {/* Step indicator */}
      <ol className="flex items-center gap-2 mb-8" aria-label="Application progress">
        {STEPS.map((step, i) => {
          const active = i === stepIndex;
          const done = i < stepIndex;
          return (
            <li key={step.key} className="flex items-center gap-2 flex-1 last:flex-none">
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 w-full border ${active
                    ? "bg-indigo-50 border-indigo-200"
                    : done
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-white border-slate-200"
                  }`}
              >
                <span
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${active
                      ? "bg-indigo-600 text-white"
                      : done
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={`text-xs font-bold hidden sm:block ${active ? "text-indigo-700" : done ? "text-emerald-700" : "text-slate-500"
                    }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-slate-200 hidden sm:block" />}
            </li>
          );
        })}
      </ol>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {/* STEP 1: Personal */}
        {stepIndex === 0 && (
          <div className="space-y-5 max-w-2xl">
            <h2 className="text-base font-bold text-slate-900">Personal Details</h2>
            <Field label="Full Name" htmlFor="app-name" error={errors.personal.applicantName}>
              <TextInput
                id="app-name"
                value={personal.applicantName}
                onChange={(e) =>
                  setPersonal((p) => ({ ...p, applicantName: e.target.value }))
                }
                placeholder="As per 10th / 12th marksheet"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Email" htmlFor="app-email" error={errors.personal.email}>
                <TextInput
                  id="app-email"
                  type="email"
                  value={personal.email}
                  onChange={(e) => setPersonal((p) => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Phone" htmlFor="app-phone" error={errors.personal.phone}>
                <TextInput
                  id="app-phone"
                  value={personal.phone}
                  onChange={(e) => setPersonal((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Gender" htmlFor="app-gender" error={errors.personal.gender}>
                <SelectInput
                  id="app-gender"
                  value={personal.gender}
                  onChange={(e) => setPersonal((p) => ({ ...p, gender: e.target.value }))}
                >
                  <option value="">Select gender…</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Date of Birth" htmlFor="app-dob" error={errors.personal.dob}>
                <TextInput
                  id="app-dob"
                  type="date"
                  value={personal.dob}
                  onChange={(e) => setPersonal((p) => ({ ...p, dob: e.target.value }))}
                />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 2: Academic */}
        {stepIndex === 1 && (
          <div className="space-y-5 max-w-2xl">
            <h2 className="text-base font-bold text-slate-900">Academic & Program Details</h2>

            {cyclesLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading available cycles…
              </div>
            ) : cyclesError ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                <Info className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Could not load admission cycles</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {cyclesError} Please try again or contact the admissions office.
                  </p>
                </div>
              </div>
            ) : cycles.length === 0 ? (
              <EmptyState
                title="No active admission cycles"
                description="There are no open cycles right now. Please check back later."
              />
            ) : (
              <div className="space-y-5">
                <Field label="School / Constituent Unit" htmlFor="app-school" error={errors.academic.schoolId}>
                  <SelectInput
                    id="app-school"
                    value={academic.schoolId}
                    onChange={(e) =>
                      setAcademic((a) => ({
                        ...a,
                        schoolId: e.target.value,
                        cycleId: "",
                        programId: "",
                      }))
                    }
                  >
                    {CONSTITUENT_SCHOOLS.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.code} — {school.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="Admission Cycle" htmlFor="app-cycle" error={errors.academic.cycleId}>
                  <SelectInput
                    id="app-cycle"
                    value={academic.cycleId}
                    onChange={(e) => setAcademic((a) => ({ ...a, cycleId: e.target.value }))}
                  >
                    <option value="">Select cycle…</option>
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.academicYear})
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="Program" htmlFor="app-program" error={errors.academic.programId}>
                  <SelectInput
                    id="app-program"
                    value={academic.programId}
                    onChange={(e) => setAcademic((a) => ({ ...a, programId: e.target.value }))}
                  >
                    <option value="">Select program…</option>
                    {programsForSchool.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Category" htmlFor="app-category" error={errors.academic.category}>
                    <SelectInput
                      id="app-category"
                      value={academic.category}
                      onChange={(e) => setAcademic((a) => ({ ...a, category: e.target.value }))}
                    >
                      <option value="">Select category…</option>
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field
                    label="Qualifying Marks (%)"
                    htmlFor="app-marks"
                    error={errors.academic.marksPercentage}
                  >
                    <TextInput
                      id="app-marks"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.01"
                      value={academic.marksPercentage}
                      onChange={(e) =>
                        setAcademic((a) => ({ ...a, marksPercentage: e.target.value }))
                      }
                      placeholder="e.g. 88.50"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Documents */}
        {stepIndex === 2 && (
          <div className="space-y-5 max-w-2xl">
            <h2 className="text-base font-bold text-slate-900">Supporting Documents</h2>
            <p className="text-xs text-slate-500">
              Attach links to scanned copies (Marksheets, ID proof, etc.). Each document needs a
              name and a valid public URL.
            </p>
            <div className="space-y-4">
              {documents.map((doc, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-600">Document {index + 1}</span>
                    {documents.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDocuments((list) => list.filter((_, i) => i !== index));
                          setErrors((prev) => ({
                            ...prev,
                            documents: prev.documents.filter((_, i) => i !== index),
                          }));
                        }}
                        aria-label={`Remove document ${index + 1}`}
                        className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Field label="Document Name">
                    <TextInput
                      value={doc.name}
                      onChange={(e) => updateDoc(index, { name: e.target.value })}
                      placeholder="e.g. 12th Marksheet"
                    />
                  </Field>
                  <Field label="Document URL" error={errors.documents[index]}>
                    <TextInput
                      type="url"
                      value={doc.url}
                      onChange={(e) => updateDoc(index, { url: e.target.value })}
                      placeholder="https://…"
                    />
                  </Field>
                  {errors.documents[index] && (
                    <p className="text-[11px] font-medium text-rose-600" role="alert">
                      {errors.documents[index]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setDocuments((list) => [...list, { name: "", url: "" }]);
                setErrors((prev) => ({ ...prev, documents: [...prev.documents, ""] }));
              }}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another document
            </button>
          </div>
        )}

        {/* STEP 4: Preview */}
        {stepIndex === 3 && (
          <div className="space-y-5 max-w-2xl">
            <h2 className="text-base font-bold text-slate-900">Review & Submit</h2>

            {submitError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-700" role="alert">
                {submitError}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 rounded-t-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Personal Details
                </span>
              </div>
              {[
                ["Full Name", personal.applicantName],
                ["Email", personal.email],
                ["Phone", personal.phone],
                ["Gender", personal.gender || "—"],
                ["Date of Birth", personal.dob || "—"],
              ].map(([label, value]) => (
                <div key={label} className="px-4 py-3 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-semibold text-slate-800 text-right">{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 rounded-t-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Academic Details
                </span>
              </div>
              {[
                ["School", CONSTITUENT_SCHOOLS.find((s) => s.id === academic.schoolId)?.code ?? "—"],
                ["Cycle", selectedCycle ? `${selectedCycle.title} (${selectedCycle.academicYear})` : "—"],
                ["Program", PROGRAMS.find((p) => p.id === academic.programId)?.name ?? "—"],
                ["Category", academic.category || "—"],
                ["Marks (%)", academic.marksPercentage || "—"],
              ].map(([label, value]) => (
                <div key={label} className="px-4 py-3 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-semibold text-slate-800 text-right">{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 rounded-t-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Documents ({documents.filter((d) => d.name.trim() && d.url.trim()).length})
                </span>
              </div>
              {documents.filter((d) => d.name.trim() && d.url.trim()).length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">No documents attached.</div>
              ) : (
                documents
                  .filter((d) => d.name.trim() && d.url.trim())
                  .map((d) => (
                    <div key={d.url} className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-xs font-semibold text-slate-800">{d.name}</span>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        View link →
                      </a>
                    </div>
                  ))
              )}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-start gap-3">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">
                By submitting, you confirm the information provided is accurate and complete.
                Misrepresentation may lead to rejection of your application.
              </p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 mt-8 pt-6">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {stepIndex < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Application
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
