"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Eye, Banknote } from "lucide-react";
import { PageTitle } from "@/components/fees/FeesShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { InvoiceStatusBadge } from "@/components/fees/InvoiceStatusBadge";
import { InvoiceDetailModal } from "@/components/fees/InvoiceDetailModal";
import { RecordPaymentModal } from "@/components/fees/RecordPaymentModal";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS, fullName, programCode, StudentSummary, fetchStudents } from "@/lib/students";
import {
  academicYearChoices,
  academicYearOf,
  createPayment,
  CreatePaymentInput,
  FeesApiError,
  fetchInvoices,
  fetchStructures,
  formatAmount,
  formatDate,
  generateInvoice,
  GenerateInvoiceInput,
  Invoice,
  InvoiceStatus,
  FeeStructure,
} from "@/lib/fees";

interface GenerateModalState {
  open: boolean;
}

export default function FeesInvoicesPage() {
  const { currentUser } = useUniversity();
  const isFinance = currentUser?.role === "FINANCE_OFFICER";
  const isCentral = currentUser?.schoolId === "ALL";

  const [rows, setRows] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [programFilter, setProgramFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const [studentMap, setStudentMap] = useState<Map<string, StudentSummary>>(new Map());

  const [generateModal, setGenerateModal] = useState<GenerateModalState>({ open: false });
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [viewTarget, setViewTarget] = useState<Invoice | null>(null);

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [invoices, structureRows] = await Promise.all([
        fetchInvoices({ status: statusFilter || undefined }),
        fetchStructures(),
      ]);
      setStructures(structureRows);
      setRows(invoices);
      if (isFinance) {
        const studentRows = await fetchStudents();
        setStudents(studentRows);
        const map = new Map<string, StudentSummary>();
        studentRows.forEach((s) => map.set(s.id, s));
        setStudentMap(map);
      } else {
        setStudents([]);
        setStudentMap(new Map());
      }
    } catch (e) {
      setLoadError(e instanceof FeesApiError ? e.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isFinance]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return rows.filter((inv) => {
      const s = studentMap.get(inv.studentId);
      if (programFilter && s?.programId !== programFilter) return false;
      if (yearFilter && academicYearOf(inv.dueDate) !== yearFilter) return false;
      return true;
    });
  }, [rows, studentMap, programFilter, yearFilter]);

  const viewLabel = (inv: Invoice) => {
    if (!isFinance) return currentUser?.name || "—";
    const s = studentMap.get(inv.studentId);
    return s ? fullName(s) : "—";
  };

  const programLabel = (inv: Invoice) => {
    if (!isFinance) return "—";
    const s = studentMap.get(inv.studentId);
    return s ? programCode(s.programId) : "—";
  };

  const submitGenerate = async (input: GenerateInvoiceInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await generateInvoice(input);
      setGenerateModal({ open: false });
      setToast({
        message: `Invoice ${res.invoiceNo} generated for ${formatAmount(res.amount)}.`,
        type: "success",
      });
      load();
    } catch (e) {
      setSubmitError(e instanceof FeesApiError ? e.message : "Unable to generate invoice.");
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async (input: CreatePaymentInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await createPayment(input);
      setPayTarget(null);
      setToast({ message: `Payment recorded. Receipt ${res.receiptNo}.`, type: "success" });
      load();
    } catch (e) {
      setSubmitError(e instanceof FeesApiError ? e.message : "Unable to record payment.");
    } finally {
      setBusy(false);
    }
  };

  const payableInvoices = useMemo(() => rows.filter((i) => i.status !== "PAID"), [rows]);

  const generateForm = (
    <ModalForm
      open={generateModal.open}
      students={students}
      structures={structures}
      busy={busy}
      error={submitError}
      schoolRequired={isCentral}
      onClose={() => setGenerateModal({ open: false })}
      onSubmit={submitGenerate}
    />
  );

  return (
    <div>
      <PageTitle
        title="Invoices"
        subtitle="Generated fee invoices and their payment status."
        action={
          isFinance ? (
            <button
              type="button"
              onClick={() => setGenerateModal({ open: true })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Generate invoice
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        {isFinance && (
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="w-full sm:w-56 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
            aria-label="Filter by program"
          >
            <option value="">All programs</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        )}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="w-full sm:w-44 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
          aria-label="Filter by academic year"
        >
          <option value="">All years</option>
          {academicYearChoices().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
          className="w-full sm:w-40 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No invoices"
            description="Invoices generated for students will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Invoice</th>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">Program</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5 text-right">Paid</th>
                  <th className="px-5 py-3.5">Due date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 tabular-nums">{inv.invoiceNo}</td>
                    <td className="px-5 py-3.5 text-slate-600">{viewLabel(inv)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{programLabel(inv)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                      {formatAmount(inv.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 tabular-nums">
                      {formatAmount(inv.paidAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewTarget(inv)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        {isFinance && inv.status !== "PAID" && (
                          <button
                            type="button"
                            onClick={() => setPayTarget(inv)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Pay
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

      {generateForm}

      <RecordPaymentModal
        open={!!payTarget}
        invoices={payableInvoices}
        defaultInvoice={payTarget}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral}
        onClose={() => {
          setPayTarget(null);
          setSubmitError(null);
        }}
        onSubmit={submitPayment}
      />

      <InvoiceDetailModal
        open={!!viewTarget}
        invoice={viewTarget}
        studentLabel={viewTarget ? viewLabel(viewTarget) : undefined}
        programLabel={viewTarget ? programLabel(viewTarget) : undefined}
        onClose={() => setViewTarget(null)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ---- Generate-invoice modal (kept colocated for the invoices screen) -----------

import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";

function ModalForm({
  open,
  students,
  structures,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: {
  open: boolean;
  students: StudentSummary[];
  structures: FeeStructure[];
  busy: boolean;
  error?: string | null;
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: GenerateInvoiceInput) => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [structureId, setStructureId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<{
    schoolId?: string;
    studentId?: string;
    structureId?: string;
    dueDate?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setStudentId("");
    setStructureId("");
    setDueDate("");
    setErrors({});
  }, [open]);

  const selectedStructure = structures.find((s) => s.id === structureId);

  const submit = () => {
    const errs: typeof errors = {};
    if (schoolRequired && !schoolId) errs.schoolId = "Select a school.";
    if (!studentId) errs.studentId = "Select a student.";
    if (!structureId) errs.structureId = "Select a fee structure.";
    if (!dueDate) errs.dueDate = "Pick a due date.";
    setErrors(errs);
    if (errs.schoolId || errs.studentId || errs.structureId || errs.dueDate) return;
    onSubmit({
      studentId,
      structureId,
      dueDate,
      ...(schoolRequired ? { schoolId } : {}),
    });
  };

  return (
    <Modal open={open} onClose={() => (busy ? undefined : onClose())} title="Generate invoice" description="Create a fee invoice for a student.">
      <div className="space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} disabled={busy} error={errors.schoolId} />
        )}
        <Field label="Student" htmlFor="gen-student" error={errors.studentId}>
          <SelectInput id="gen-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={busy}>
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rollNo} — {fullName(s)}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Fee structure" htmlFor="gen-structure" error={errors.structureId}>
          <SelectInput
            id="gen-structure"
            value={structureId}
            onChange={(e) => setStructureId(e.target.value)}
            disabled={busy}
          >
            <option value="">Select structure</option>
            {structures.map((st) => (
              <option key={st.id} value={st.id}>
                {programCode(st.programId)} · {st.academicYear} · Sem {st.semester} — {formatAmount(st.totalAmount)}
              </option>
            ))}
          </SelectInput>
        </Field>

        {selectedStructure && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500">Amount to bill</span>
            <span className="font-extrabold text-slate-900 text-base">{formatAmount(selectedStructure.totalAmount)}</span>
          </div>
        )}

        <Field label="Due date" htmlFor="gen-due" error={errors.dueDate}>
          <TextInput
            id="gen-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={busy}
          />
        </Field>

        {error && (
          <p
            className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? <InlineLoader label="Generating…" /> : "Generate invoice"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
