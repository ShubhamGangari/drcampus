"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, BookOpenCheck } from "lucide-react";
import { PageTitle } from "@/components/students/StudentsShell";
import { Modal } from "@/components/admissions/Modal";
import { Toast } from "@/components/admissions/Toast";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { EmptyState, ErrorState, LoadingSkeleton, InlineLoader } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
  StudentSummary,
  Enrollment,
  fetchStudents,
  fetchStudent,
  enrollStudent,
  StudentsApiError,
  fullName,
  PROGRAM_OPTIONS,
  isAdminRole,
} from "@/lib/students";

interface EnrollmentRow {
  student: StudentSummary;
  enrollment: Enrollment;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => `${CURRENT_YEAR + i}-${CURRENT_YEAR + i + 1}`);
const SEMESTER_OPTIONS = Array.from({ length: 8 }, (_, i) => i + 1);

export default function EnrollmentsPage() {
  const { currentUser } = useUniversity();
  const isAdmin = isAdminRole(currentUser?.role) || !!currentUser?.isCentral;

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ studentId: "", academicYear: "", semester: "" });
  const [enrollErrors, setEnrollErrors] = useState<Partial<Record<string, string>>>({});
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchStudents();
      setStudents(list);
      // The contract exposes enrollments only inside per-student details; enrich
      // the roster to build the enrollments table.
      const enriched = await Promise.all(
        list.map(async (s) => {
          try {
            const detail = await fetchStudent(s.id);
            return detail.enrollments.map((en) => ({ student: s, enrollment: en }));
          } catch {
            return [] as EnrollmentRow[];
          }
        })
      );
      setRows(enriched.flat());
    } catch (e) {
      setLoadError(e instanceof StudentsApiError ? e.message : "Unable to load enrollments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enrollableStudents = useMemo(
    () => students.filter((s) => s.status !== "GRADUATED" && s.status !== "DROPPED"),
    [students]
  );

  const confirmEnroll = async () => {
    const errors: Partial<Record<string, string>> = {};
    if (!enrollForm.studentId) errors.studentId = "Select a student.";
    if (!enrollForm.academicYear) errors.academicYear = "Select an academic year.";
    if (!enrollForm.semester) errors.semester = "Select a semester.";
    setEnrollErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setEnrolling(true);
    setEnrollError(null);
    try {
      await enrollStudent(enrollForm.studentId, {
        academicYear: enrollForm.academicYear,
        semester: Number(enrollForm.semester),
      });
      setShowEnroll(false);
      setEnrollForm({ studentId: "", academicYear: "", semester: "" });
      setToast({ message: "Student enrolled for the academic year.", type: "success" });
      load();
    } catch (e) {
      setEnrollError(e instanceof StudentsApiError ? e.message : "Unable to enroll student.");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Enrollments"
        subtitle="Academic enrollments across students, academic years and semesters."
        action={
          isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setEnrollForm({ studentId: "", academicYear: "", semester: "" });
                setEnrollErrors({});
                setEnrollError(null);
                setShowEnroll(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Enroll
            </button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No enrollments"
            description="Enrollment records will appear here once students are enrolled into academic years."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">Program</th>
                  <th className="px-5 py-3.5">Academic Year</th>
                  <th className="px-5 py-3.5">Semester</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((row) => (
                  <tr key={`${row.student.id}-${row.enrollment.id}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{fullName(row.student)}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{row.student.rollNo}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold text-slate-600">
                        {PROGRAM_OPTIONS.find((p) => p.id === row.student.programId)?.code ??
                          row.student.programId}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600">{row.enrollment.academicYear}</td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                      Semester {row.enrollment.semester}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
                        <BookOpenCheck className="h-3.5 w-3.5" />
                        {row.enrollment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enroll modal */}
      <Modal
        open={showEnroll}
        onClose={() => setShowEnroll(false)}
        title="Enroll Student"
        description="Register a student into an academic year and semester. Admin only."
      >
        <div className="space-y-4">
          <Field label="Student" error={enrollErrors.studentId}>
            <SelectInput
              value={enrollForm.studentId}
              onChange={(e) => setEnrollForm((f) => ({ ...f, studentId: e.target.value }))}
            >
              <option value="">Select student</option>
              {enrollableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {fullName(s)} ({s.rollNo})
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Academic year" error={enrollErrors.academicYear}>
              <SelectInput
                value={enrollForm.academicYear}
                onChange={(e) => setEnrollForm((f) => ({ ...f, academicYear: e.target.value }))}
              >
                <option value="">Select year</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Semester" error={enrollErrors.semester}>
              <SelectInput
                value={enrollForm.semester}
                onChange={(e) => setEnrollForm((f) => ({ ...f, semester: e.target.value }))}
              >
                <option value="">Select semester</option>
                {SEMESTER_OPTIONS.map((s) => (
                  <option key={s} value={String(s)}>
                    Semester {s}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          {enrollError && (
            <p
              className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
              role="alert"
            >
              {enrollError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowEnroll(false)}
              disabled={enrolling}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmEnroll}
              disabled={enrolling}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {enrolling ? <InlineLoader label="Enrolling…" /> : "Enroll"}
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
