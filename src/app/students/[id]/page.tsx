"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  PencilLine,
  CalendarClock,
  ArrowRightLeft,
  BookOpenCheck,
  FileText,
  History,
  Mail,
  Phone,
  CalendarDays,
  Users,
} from "lucide-react";
import { PageTitle } from "@/components/students/StudentsShell";
import { Modal } from "@/components/admissions/Modal";
import { Toast } from "@/components/admissions/Toast";
import { Field, TextInput, SelectInput, TextArea } from "@/components/admissions/FormControls";
import { EmptyState, ErrorState, LoadingSkeleton, InlineLoader } from "@/components/admissions/States";
import { StudentStatusBadge } from "@/components/students/StudentStatusBadge";
import { useUniversity } from "@/context/UniversityContext";
import {
  StudentDetail,
  StudentStatus,
  UpdateStudentInput,
  LeaveRequestInput,
  TransferRequestInput,
  PROGRAM_OPTIONS,
  BatchOption,
  LEAVE_TYPE_OPTIONS,
  fetchStudent,
  fetchBatches,
  updateStudent,
  requestLeave,
  requestTransfer,
  StudentsApiError,
  fullName,
  formatDate,
  formatDateTime,
  batchLabel,
  programName,
  isAdminRole,
} from "@/lib/students";

type Tab = "personal" | "academic" | "documents" | "history";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "personal", label: "Personal", icon: Users },
  { id: "academic", label: "Academic", icon: BookOpenCheck },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "history", label: "History", icon: History },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-900 break-words">{value}</p>
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = params?.id ?? "";

  const { currentUser } = useUniversity();
  const isAdmin = isAdminRole(currentUser?.role) || !!currentUser?.isCentral;
  const isStudent = currentUser?.role === "STUDENT";

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allBatches, setAllBatches] = useState<BatchOption[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("personal");

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    status: "ACTIVE" as StudentStatus,
  });
  const [editErrors, setEditErrors] = useState<Partial<Record<string, string>>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [showLeave, setShowLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState<LeaveRequestInput>({
    type: "",
    fromDate: "",
    toDate: "",
    reason: "",
  });
  const [leaveErrors, setLeaveErrors] = useState<Partial<Record<keyof LeaveRequestInput, string>>>({});
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferRequestInput>({
    toProgramId: "",
    reason: "",
  });
  const [transferErrors, setTransferErrors] = useState<Partial<Record<keyof TransferRequestInput, string>>>({});
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchStudent(studentId);
      setStudent(data);
      setEditForm({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        status: data.status,
      });
    } catch (e) {
      setLoadError(e instanceof StudentsApiError ? e.message : "Unable to load student.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) load();
  }, [studentId, load]);

  // Load the tenant's batches so the Batch field can show the batch name.
  useEffect(() => {
    let cancelled = false;
    fetchBatches()
      .then((list) => {
        if (!cancelled) setAllBatches(list);
      })
      .catch(() => {
        /* batch label is non-critical; fall back to id */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmEdit = async () => {
    const errors: Partial<Record<string, string>> = {};
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
      await updateStudent(studentId, patch);
      setShowEdit(false);
      setToast({ message: "Student profile updated.", type: "success" });
      load();
    } catch (e) {
      setEditError(e instanceof StudentsApiError ? e.message : "Unable to update student.");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmLeave = async () => {
    const errors: Partial<Record<keyof LeaveRequestInput, string>> = {};
    if (!leaveForm.type) errors.type = "Select a leave type.";
    if (!leaveForm.fromDate) errors.fromDate = "Start date is required.";
    if (!leaveForm.toDate) errors.toDate = "End date is required.";
    if (leaveForm.fromDate && leaveForm.toDate && leaveForm.toDate < leaveForm.fromDate)
      errors.toDate = "End date cannot be before the start date.";
    if (leaveForm.reason.trim().length < 10) errors.reason = "Please provide a reason (min 10 characters).";
    setLeaveErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmittingLeave(true);
    setLeaveError(null);
    try {
      await requestLeave(studentId, {
        type: leaveForm.type,
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        reason: leaveForm.reason.trim(),
      });
      setShowLeave(false);
      setLeaveForm({ type: "", fromDate: "", toDate: "", reason: "" });
      setToast({ message: "Leave request submitted.", type: "success" });
      load();
    } catch (e) {
      setLeaveError(e instanceof StudentsApiError ? e.message : "Unable to submit leave request.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const confirmTransfer = async () => {
    const errors: Partial<Record<keyof TransferRequestInput, string>> = {};
    if (!transferForm.toProgramId) errors.toProgramId = "Select a target program.";
    else if (transferForm.toProgramId === student?.programId)
      errors.toProgramId = "Target program must differ from the current program.";
    if (transferForm.reason.trim().length < 10) errors.reason = "Please provide a reason (min 10 characters).";
    setTransferErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmittingTransfer(true);
    setTransferError(null);
    try {
      await requestTransfer(studentId, {
        toProgramId: transferForm.toProgramId,
        reason: transferForm.reason.trim(),
      });
      setShowTransfer(false);
      setTransferForm({ toProgramId: "", reason: "" });
      setToast({ message: "Transfer request submitted.", type: "success" });
      load();
    } catch (e) {
      setTransferError(e instanceof StudentsApiError ? e.message : "Unable to submit transfer request.");
    } finally {
      setSubmittingTransfer(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="h-10 w-64 bg-slate-200 rounded-xl animate-pulse mb-6" />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <LoadingSkeleton rows={6} />
        </div>
      </div>
    );
  }

  if (loadError || !student) {
    return (
      <div>
        <PageTitle title="Student" />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <ErrorState message={loadError ?? "Student not found."} onRetry={load} />
        </div>
      </div>
    );
  }

  const actionButtons: React.ReactNode[] = [];
  if (isStudent) {
    actionButtons.push(
      <button
        key="leave"
        type="button"
        onClick={() => {
          setLeaveForm({ type: "", fromDate: "", toDate: "", reason: "" });
          setLeaveErrors({});
          setLeaveError(null);
          setShowLeave(true);
        }}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
      >
        <CalendarClock className="h-4 w-4" />
        Request Leave
      </button>,
      <button
        key="transfer"
        type="button"
        onClick={() => {
          setTransferForm({ toProgramId: "", reason: "" });
          setTransferErrors({});
          setTransferError(null);
          setShowTransfer(true);
        }}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Request Transfer
      </button>
    );
  }
  if (isAdmin) {
    actionButtons.push(
      <button
        key="edit"
        type="button"
        onClick={() => {
          setEditErrors({});
          setEditError(null);
          setShowEdit(true);
        }}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
      >
        <PencilLine className="h-4 w-4" />
        Edit Profile
      </button>
    );
  }

  return (
    <div>
      <PageTitle
        title={`${fullName(student)} · ${student.rollNo}`}
        subtitle={student.email}
        action={actionButtons.length > 0 ? <>{actionButtons}</> : undefined}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mb-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${active
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "personal" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-sm font-bold text-slate-900">Personal Details</h2>
            <StudentStatusBadge status={student.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <InfoRow icon={Users} label="First Name" value={student.firstName} />
            <InfoRow icon={Users} label="Last Name" value={student.lastName} />
            <InfoRow icon={Mail} label="Email" value={student.email} />
            <InfoRow icon={Phone} label="Phone" value={student.phone || "—"} />
            <InfoRow icon={CalendarDays} label="Date of Birth" value={formatDate(student.dob)} />
            <InfoRow icon={Users} label="Gender" value={student.gender || "—"} />
            <InfoRow icon={Users} label="Category" value={student.category || "—"} />
            <InfoRow icon={CalendarDays} label="Admission Date" value={formatDate(student.admissionDate)} />
            <InfoRow icon={FileText} label="Roll No" value={student.rollNo} />
          </div>
        </div>
      )}

      {activeTab === "academic" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-5">Program & Batch</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow icon={BookOpenCheck} label="Program" value={programName(student.programId)} />
              <InfoRow icon={Users} label="Batch" value={batchLabel(student.batchId, allBatches)} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Enrollments</h2>
              <span className="text-xs font-bold text-slate-400">{student.enrollments.length} records</span>
            </div>
            {student.enrollments.length === 0 ? (
              <EmptyState
                title="No enrollments"
                description="This student has no enrollment records yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-5 py-3.5">Academic Year</th>
                      <th className="px-5 py-3.5">Semester</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {student.enrollments.map((en) => (
                      <tr key={en.id}>
                        <td className="px-5 py-4 font-semibold text-slate-900">{en.academicYear}</td>
                        <td className="px-5 py-4 text-slate-700">Semester {en.semester}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
                            {en.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <EmptyState
            title="No documents on record"
            description="The student lifecycle API contract does not yet expose a document repository for individual students."
          />
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-5">Lifecycle History</h2>
          {student.history.length === 0 ? (
            <EmptyState
              title="No history events"
              description="Significant lifecycle events (enrollment, leave, transfer, graduation) will appear here."
            />
          ) : (
            <ol className="relative border-l border-slate-200 ml-3 space-y-6">
              {student.history.map((h) => (
                <li key={h.id} className="pl-6 relative">
                  <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full bg-indigo-500 border-2 border-white shadow" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-bold text-slate-900">{h.event}</p>
                    <span className="text-[11px] font-semibold text-slate-400">{formatDateTime(h.date)}</span>
                  </div>
                  {h.detail && <p className="text-xs text-slate-500 mt-1">{h.detail}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Edit profile modal */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Profile"
        description={`${fullName(student)} — ${student.rollNo}`}
      >
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
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="GRADUATED">Graduated</option>
                <option value="DROPPED">Dropped</option>
              </SelectInput>
            </Field>
          </div>

          {editError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5" role="alert">
              {editError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowEdit(false)}
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
      </Modal>

      {/* Request leave modal */}
      <Modal
        open={showLeave}
        onClose={() => setShowLeave(false)}
        title="Request Leave"
        description={`${fullName(student)} — ${student.rollNo}`}
      >
        <div className="space-y-4">
          <Field label="Leave type" error={leaveErrors.type}>
            <SelectInput
              value={leaveForm.type}
              onChange={(e) => setLeaveForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="">Select type</option>
              {LEAVE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="From date" error={leaveErrors.fromDate}>
              <TextInput
                type="date"
                value={leaveForm.fromDate}
                onChange={(e) => setLeaveForm((f) => ({ ...f, fromDate: e.target.value }))}
              />
            </Field>
            <Field label="To date" error={leaveErrors.toDate}>
              <TextInput
                type="date"
                value={leaveForm.toDate}
                onChange={(e) => setLeaveForm((f) => ({ ...f, toDate: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Reason" error={leaveErrors.reason}>
            <TextArea
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
              rows={4}
              placeholder="Explain the reason for this leave request"
            />
          </Field>

          {leaveError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5" role="alert">
              {leaveError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowLeave(false)}
              disabled={submittingLeave}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmLeave}
              disabled={submittingLeave}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submittingLeave ? <InlineLoader label="Submitting…" /> : "Submit Request"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Request transfer modal */}
      <Modal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        title="Request Transfer"
        description={`${fullName(student)} — ${student.rollNo}`}
      >
        <div className="space-y-4">
          <Field label="Target program" error={transferErrors.toProgramId}>
            <SelectInput
              value={transferForm.toProgramId}
              onChange={(e) => setTransferForm((f) => ({ ...f, toProgramId: e.target.value }))}
            >
              <option value="">Select program</option>
              {PROGRAM_OPTIONS.filter((p) => p.id !== student.programId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Reason" error={transferErrors.reason}>
            <TextArea
              value={transferForm.reason}
              onChange={(e) => setTransferForm((f) => ({ ...f, reason: e.target.value }))}
              rows={4}
              placeholder="Explain the reason for this transfer request"
            />
          </Field>

          {transferError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5" role="alert">
              {transferError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowTransfer(false)}
              disabled={submittingTransfer}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmTransfer}
              disabled={submittingTransfer}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submittingTransfer ? <InlineLoader label="Submitting…" /> : "Submit Request"}
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
