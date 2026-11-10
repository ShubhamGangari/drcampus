"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { PageTitle } from "@/components/exams/ExamsShell";
import { ExamStatusBadge, ExamTypeBadge } from "@/components/exams/ExamBadges";
import { CreateExamModal } from "@/components/exams/CreateExamModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS, programCode } from "@/lib/students";
import { academicYearChoices } from "@/lib/fees";
import {
  CreateExamInput,
  Exam,
  ExamStatus,
  ExamsApiError,
  fetchExams,
  createExam,
} from "@/lib/exams";

export default function ExamsPage() {
  const { currentUser } = useUniversity();
  const isExamController = currentUser?.role === "EXAM_CONTROLLER";
  const isCentral = currentUser?.schoolId === "ALL";

  const [rows, setRows] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [programFilter, setProgramFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExamStatus | "">("");

  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const yearChoices = academicYearChoices();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchExams({
        programId: programFilter || undefined,
        academicYear: yearFilter || undefined,
        status: statusFilter || undefined,
      });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof ExamsApiError ? e.message : "Unable to load exams.");
    } finally {
      setLoading(false);
    }
  }, [programFilter, yearFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (input: CreateExamInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createExam(input);
      setCreateOpen(false);
      setToast({ message: "Exam created.", type: "success" });
      load();
    } catch (e) {
      setSubmitError(e instanceof ExamsApiError ? e.message : "Unable to create exam.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Exams"
        subtitle="Define examinations per program, year and semester."
        action={
          isExamController ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Exam
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All programs</option>
          {PROGRAM_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All years</option>
          {yearChoices.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ExamStatus | "")}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="COMPLETED">Completed</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No exams yet"
          description="Create an examination to start configuring schedules, hall tickets and marks entry."
          action={
            isExamController ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Exam
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50/80">
                  <th className="px-4 py-3 font-bold">Title</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Program</th>
                  <th className="px-4 py-3 font-bold">Year</th>
                  <th className="px-4 py-3 font-bold">Sem</th>
                  <th className="px-4 py-3 font-bold text-right">Max Int/Ext</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{exam.title}</td>
                    <td className="px-4 py-3.5">
                      <ExamTypeBadge type={exam.type} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{programCode(exam.programId)}</td>
                    <td className="px-4 py-3.5 text-slate-600">{exam.academicYear}</td>
                    <td className="px-4 py-3.5 text-slate-600">{exam.semester}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600">
                      {exam.maxInternal}/{exam.maxExternal}
                    </td>
                    <td className="px-4 py-3.5">
                      <ExamStatusBadge status={exam.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/exams/schedules?examId=${exam.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        title="View schedules for this exam"
                      >
                        View
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateExamModal
        open={createOpen}
        busy={busy}
        error={submitError}
        schoolRequired={isExamController && isCentral}
        onClose={() => setCreateOpen(false)}
        onSubmit={submit}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
