"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, Eye, PencilLine, Upload, Download, FileUp } from "lucide-react";
import { PageTitle } from "@/components/students/StudentsShell";
import { Modal } from "@/components/admissions/Modal";
import { Toast } from "@/components/admissions/Toast";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { EmptyState, ErrorState, LoadingSkeleton, InlineLoader } from "@/components/admissions/States";
import { StudentStatusBadge } from "@/components/students/StudentStatusBadge";
import { useUniversity } from "@/context/UniversityContext";
import {
  StudentSummary,
  StudentStatus,
  CreateStudentInput,
  UpdateStudentInput,
  PROGRAM_OPTIONS,
  BatchOption,
  STUDENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  CATEGORY_OPTIONS,
  createStudent,
  fetchStudents,
  fetchStudent,
  fetchBatches,
  updateStudent,
  importStudents,
  fetchStudentExport,
  downloadExport,
  StudentsApiError,
  fullName,
  formatDate,
  batchLabel,
  isAdminRole,
  type StudentImportResult,
} from "@/lib/students";

interface StudentRow extends StudentSummary {
  admissionDate?: string;
}

interface Filters {
  programId: string;
  batchId: string;
  status: StudentStatus | "";
  search: string;
}

const EMPTY_FILTERS: Filters = {
  programId: "",
  batchId: "",
  status: "",
  search: "",
};

interface CreateForm {
  admissionId: string;
  programId: string;
  batchId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  category: string;
}

const EMPTY_CREATE: CreateForm = {
  admissionId: "",
  programId: "",
  batchId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  category: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCreate(form: CreateForm): Partial<Record<keyof CreateForm, string>> {
  const errors: Partial<Record<keyof CreateForm, string>> = {};
  if (form.firstName.trim().length < 2) errors.firstName = "First name must be at least 2 characters.";
  if (form.lastName.trim().length < 2) errors.lastName = "Last name must be at least 2 characters.";
  if (!form.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!form.phone.trim()) errors.phone = "Phone is required.";
  else if (!/^\d{10}$/.test(form.phone.trim())) errors.phone = "Enter a 10-digit phone number.";
  if (!form.dob) errors.dob = "Date of birth is required.";
  if (!form.gender) errors.gender = "Select a gender.";
  if (!form.category) errors.category = "Select a category.";
  if (!form.programId) errors.programId = "Select a program.";
  if (!form.batchId) errors.batchId = "Select a batch.";
  return errors;
}

interface EditForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: StudentStatus;
}

export default function StudentsPage() {
  const { currentUser } = useUniversity();
  const isAdmin = isAdminRole(currentUser?.role) || !!currentUser?.isCentral;

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<StudentRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    status: "ACTIVE",
  });
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditForm, string>>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Import state.
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<StudentImportResult | null>(null);

  // Export state.
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // All batches for the tenant — powers the list filter and batch-name labels.
  const [allBatches, setAllBatches] = useState<BatchOption[]>([]);
  const [allBatchesLoading, setAllBatchesLoading] = useState(true);
  const [allBatchesError, setAllBatchesError] = useState<string | null>(null);

  const loadAllBatches = useCallback(async () => {
    setAllBatchesLoading(true);
    setAllBatchesError(null);
    try {
      setAllBatches(await fetchBatches());
    } catch (e) {
      setAllBatchesError(e instanceof StudentsApiError ? e.message : "Unable to load batches.");
    } finally {
      setAllBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllBatches();
  }, [loadAllBatches]);

  // Batches scoped to the selected program, used by the New Student form.
  const [createBatches, setCreateBatches] = useState<BatchOption[]>([]);
  const [createBatchesLoading, setCreateBatchesLoading] = useState(false);
  const [createBatchesError, setCreateBatchesError] = useState<string | null>(null);

  const loadCreateBatches = useCallback(async (programId: string) => {
    setCreateBatchesLoading(true);
    setCreateBatchesError(null);
    try {
      setCreateBatches(await fetchBatches(programId ? { programId } : {}));
    } catch (e) {
      setCreateBatchesError(e instanceof StudentsApiError ? e.message : "Unable to load batches.");
    } finally {
      setCreateBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showCreate) return;
    setCreateBatches([]);
    setCreateForm((f) => ({ ...f, batchId: "" }));
    loadCreateBatches(createForm.programId);
  }, [showCreate, createForm.programId, loadCreateBatches]);

  const hasActiveFilters =
    Boolean(filters.programId) || Boolean(filters.batchId) || Boolean(filters.status) || Boolean(searchText.trim());

  // Debounce the free-text search before issuing a server query.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchText.trim() })), 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchStudents({
        programId: filters.programId || undefined,
        batchId: filters.batchId || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      // The list endpoint returns summaries without `admissionDate`. Enrich rows
      // via the per-student detail endpoint so the table can render the column.
      const enriched = await Promise.all(
        list.map(async (s) => {
          try {
            const detail = await fetchStudent(s.id);
            return { ...s, admissionDate: detail.admissionDate };
          } catch {
            return s;
          }
        })
      );
      setRows(enriched);
    } catch (e) {
      setLoadError(e instanceof StudentsApiError ? e.message : "Unable to load students.");
    } finally {
      setLoading(false);
    }
  }, [filters.programId, filters.batchId, filters.status, filters.search]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (row: StudentRow) => {
    setEditTarget(row);
    setEditForm({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: "",
      status: row.status,
    });
    setEditErrors({});
    setEditError(null);
  };

  const confirmEdit = async () => {
    if (!editTarget) return;
    const errors: Partial<Record<keyof EditForm, string>> = {};
    if (editForm.firstName.trim().length < 2) errors.firstName = "First name must be at least 2 characters.";
    if (editForm.lastName.trim().length < 2) errors.lastName = "Last name must be at least 2 characters.";
    if (!editForm.email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_RE.test(editForm.email.trim())) errors.email = "Enter a valid email address.";
    if (editForm.phone && !/^\d{10}$/.test(editForm.phone.trim()))
      errors.phone = "Enter a 10-digit phone number.";
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingEdit(true);
    setEditError(null);
    try {
      const patch: UpdateStudentInput = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        status: editForm.status,
      };
      if (editForm.phone.trim()) patch.phone = editForm.phone.trim();
      await updateStudent(editTarget.id, patch);
      setEditTarget(null);
      setToast({ message: "Student profile updated.", type: "success" });
      load();
    } catch (e) {
      setEditError(e instanceof StudentsApiError ? e.message : "Unable to update student.");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmCreate = async () => {
    const errors = validateCreate(createForm);
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreating(true);
    setCreateError(null);
    try {
      const input: CreateStudentInput = {
        programId: createForm.programId,
        batchId: createForm.batchId,
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        dob: createForm.dob,
        gender: createForm.gender,
        category: createForm.category,
      };
      if (createForm.admissionId.trim()) input.admissionId = createForm.admissionId.trim();
      const res = await createStudent(input);
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      setToast({ message: `Student created — Roll No ${res.rollNo}.`, type: "success" });
      load();
    } catch (e) {
      setCreateError(e instanceof StudentsApiError ? e.message : "Unable to create student.");
    } finally {
      setCreating(false);
    }
  };

  const confirmImport = async () => {
    if (!importFile) {
      setImportError("Choose a CSV, JSON or PDF file to import.");
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await importStudents(importFile);
      setImportResult(result);
      setToast({
        message: `Import complete — ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`,
        type: "success",
      });
      load();
    } catch (e) {
      setImportError(e instanceof StudentsApiError ? e.message : "Unable to import students.");
    } finally {
      setImporting(false);
    }
  };

  const runExport = async (fmt: "csv" | "pdf") => {
    setExporting(fmt);
    try {
      const payload = await fetchStudentExport(fmt, {
        programId: filters.programId || undefined,
        batchId: filters.batchId || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      downloadExport(payload);
      setToast({ message: `Exported ${payload.filename}.`, type: "success" });
    } catch (e) {
      setToast({
        message: e instanceof StudentsApiError ? e.message : "Unable to export students.",
        type: "error",
      });
    } finally {
      setExporting(null);
    }
  };

  // Rows come directly from the server query (search is applied server-side).
  const displayRows = useMemo(() => rows, [rows]);

  return (
    <div>
      <PageTitle
        title="Students"
        subtitle="Manage student records across programs and batches."
        action={
          isAdmin ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 shadow-sm transition-colors cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <button
                type="button"
                onClick={() => runExport("csv")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {exporting === "csv" ? (
                  <InlineLoader label="Exporting…" />
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => runExport("pdf")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {exporting === "pdf" ? (
                  <InlineLoader label="Exporting…" />
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Export PDF
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateForm(EMPTY_CREATE);
                  setCreateErrors({});
                  setCreateError(null);
                  setShowCreate(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                New Student
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Program">
            <SelectInput
              value={filters.programId}
              onChange={(e) => setFilters((f) => ({ ...f, programId: e.target.value }))}
            >
              <option value="">All programs</option>
              {PROGRAM_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Batch">
            {allBatchesLoading ? (
              <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
            ) : allBatchesError ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-rose-600">{allBatchesError}</p>
                <button
                  type="button"
                  onClick={loadAllBatches}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : (
              <SelectInput
                value={filters.batchId}
                onChange={(e) => setFilters((f) => ({ ...f, batchId: e.target.value }))}
              >
                <option value="">All batches</option>
                {allBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label="Status">
            <SelectInput
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as StudentStatus | "" }))
              }
            >
              <option value="">All statuses</option>
              {STUDENT_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Search">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <TextInput
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Name, roll no, email"
                className="pl-9"
              />
            </div>
          </Field>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : displayRows.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No students found for filters" : "No students yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing the filters above."
                : "Students admitted from the Admissions module will appear here."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Roll No</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Program</th>
                  <th className="px-5 py-3.5">Batch</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Admission Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayRows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">
                      {s.rollNo}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{fullName(s)}</p>
                      <p className="text-[11px] text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {PROGRAM_OPTIONS.find((p) => p.id === s.programId)?.code ?? s.programId}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600">{batchLabel(s.batchId, allBatches)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <StudentStatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {s.admissionDate ? formatDate(s.admissionDate) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/students/${s.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Student modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Student"
        description="Create a student record. Admin only."
        wide
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First name" error={createErrors.firstName}>
              <TextInput
                value={createForm.firstName}
                onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="e.g. Aarav"
              />
            </Field>
            <Field label="Last name" error={createErrors.lastName}>
              <TextInput
                value={createForm.lastName}
                onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="e.g. Sharma"
              />
            </Field>
            <Field label="Email" error={createErrors.email}>
              <TextInput
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="student@university.edu.in"
              />
            </Field>
            <Field label="Phone" error={createErrors.phone}>
              <TextInput
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
            </Field>
            <Field label="Date of birth" error={createErrors.dob}>
              <TextInput
                type="date"
                value={createForm.dob}
                onChange={(e) => setCreateForm((f) => ({ ...f, dob: e.target.value }))}
              />
            </Field>
            <Field label="Gender" error={createErrors.gender}>
              <SelectInput
                value={createForm.gender}
                onChange={(e) => setCreateForm((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Category" error={createErrors.category}>
              <SelectInput
                value={createForm.category}
                onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Program" error={createErrors.programId}>
              <SelectInput
                value={createForm.programId}
                onChange={(e) => setCreateForm((f) => ({ ...f, programId: e.target.value }))}
              >
                <option value="">Select program</option>
                {PROGRAM_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Batch" error={createErrors.batchId}>
              {createBatchesLoading ? (
                <div className="space-y-1.5">
                  <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
                  <p className="text-[11px] text-slate-400">Loading batches…</p>
                </div>
              ) : createBatchesError ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-rose-600">{createBatchesError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateForm((f) => ({ ...f, batchId: "" }));
                      loadCreateBatches(createForm.programId);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <SelectInput
                  value={createForm.batchId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, batchId: e.target.value }))}
                >
                  <option value="">Select batch</option>
                  {createBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label="Admission ID (optional)" hint="Link to an Admissions application, if available.">
              <TextInput
                value={createForm.admissionId}
                onChange={(e) => setCreateForm((f) => ({ ...f, admissionId: e.target.value }))}
                placeholder="Application ID"
              />
            </Field>
          </div>

          {createError && (
            <p
              className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
              role="alert"
            >
              {createError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              disabled={creating}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmCreate}
              disabled={creating}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {creating ? <InlineLoader label="Creating…" /> : "Create Student"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit student modal */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Student"
        description={editTarget ? `${fullName(editTarget)} — ${editTarget.rollNo}` : undefined}
      >
        {editTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First name" error={editErrors.firstName}>
                <TextInput
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </Field>
              <Field label="Last name" error={editErrors.lastName}>
                <TextInput
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </Field>
              <Field label="Email" error={editErrors.email}>
                <TextInput
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field label="Phone" error={editErrors.phone}>
                <TextInput
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="10-digit mobile"
                  maxLength={10}
                />
              </Field>
              <Field label="Status">
                <SelectInput
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value as StudentStatus }))
                  }
                >
                  {STUDENT_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            {editError && (
              <p
                className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
                role="alert"
              >
                {editError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                disabled={savingEdit}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEdit}
                disabled={savingEdit}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {savingEdit ? <InlineLoader label="Saving…" /> : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Import students modal */}
      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Students"
        description="Upload a CSV, JSON or PDF file to create or update student records."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 hover:bg-slate-100/70 hover:border-indigo-300 transition-colors px-6 py-8 text-center">
              <Upload className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-slate-700">
                {importFile ? importFile.name : "Choose a file"}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                CSV, JSON or PDF — .csv, .json, .pdf
              </span>
              <input
                type="file"
                accept=".csv,.json,.pdf,text/csv,application/json,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null);
                  setImportError(null);
                  setImportResult(null);
                }}
              />
            </label>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Students are matched by email or roll number and updated if found; otherwise a new
            student record is created. Program and batch are resolved by code/name.
          </p>

          {importError && (
            <p
              className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
              role="alert"
            >
              {importError}
            </p>
          )}

          {importResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              <p className="font-bold mb-1.5">Import summary</p>
              <ul className="space-y-0.5">
                <li>• Created: {importResult.created}</li>
                <li>• Updated: {importResult.updated}</li>
                <li>• Skipped: {importResult.skipped}</li>
              </ul>
              {importResult.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <p className="font-bold mb-1">Row errors</p>
                  <ul className="space-y-0.5">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>
                        Row {err.row}: {err.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowImport(false)}
              disabled={importing}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmImport}
              disabled={importing || !importFile}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {importing ? <InlineLoader label="Importing…" /> : "Import Students"}
            </button>
          </div>
        </div>
      </Modal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
