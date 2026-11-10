"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Ticket } from "lucide-react";
import { PageTitle } from "@/components/exams/ExamsShell";
import { ExamPicker } from "@/components/exams/ExamPicker";
import { GenerateHallTicketModal } from "@/components/exams/GenerateHallTicketModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { fullName, fetchStudents, StudentSummary } from "@/lib/students";
import {
  ExamsApiError,
  ExamDetail,
  fetchExam,
  fetchHallTickets,
  generateHallTicket,
  HallTicket,
  formatDate,
} from "@/lib/exams";

export default function HallTicketsPage() {
  const { currentUser } = useUniversity();
  const isExamController = currentUser?.role === "EXAM_CONTROLLER";

  const [examId, setExamId] = useState("");
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [tickets, setTickets] = useState<HallTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await fetchExam(examId);
      const [ticketList, studentList] = await Promise.all([
        fetchHallTickets(examId),
        fetchStudents({ programId: detail.programId }),
      ]);
      setExam(detail);
      setTickets(ticketList);
      setStudents(studentList);
    } catch (e) {
      setLoadError(e instanceof ExamsApiError ? e.message : "Unable to load hall tickets.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitGenerate = async (studentId: string) => {
    if (!examId) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await generateHallTicket(examId, studentId);
      setGenerateOpen(false);
      setToast({ message: "Hall ticket generated.", type: "success" });
      load();
    } catch (e) {
      setSubmitError(e instanceof ExamsApiError ? e.message : "Unable to generate hall ticket.");
    } finally {
      setBusy(false);
    }
  };

  const studentMap = new Map(students.map((s) => [s.id, s]));

  return (
    <div>
      <PageTitle
        title="Hall Tickets"
        subtitle="Generate and view hall tickets per exam."
        action={
          isExamController && exam ? (
            <button
              type="button"
              onClick={() => setGenerateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Generate
            </button>
          ) : undefined
        }
      />

      <div className="max-w-md mb-5">
        <ExamPicker value={examId} onChange={setExamId} disabled={busy} />
      </div>

      {!examId ? (
        <EmptyState title="Select an exam" description="Choose an exam to view or generate hall tickets." />
      ) : loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No hall tickets"
          description={
            isExamController
              ? "Generate hall tickets for students enrolled in this exam."
              : "No hall tickets have been issued to you yet."
          }
          action={
            isExamController ? (
              <button
                type="button"
                onClick={() => setGenerateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50/80">
                  <th className="px-4 py-3 font-bold">Student</th>
                  <th className="px-4 py-3 font-bold">Roll No</th>
                  <th className="px-4 py-3 font-bold">Hall Ticket No</th>
                  <th className="px-4 py-3 font-bold">Exam</th>
                  <th className="px-4 py-3 font-bold">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => {
                  const student = studentMap.get(t.studentId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {student ? fullName(student) : "Student"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{student?.rollNo ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-indigo-700">
                          <Ticket className="h-3.5 w-3.5 text-indigo-400" />
                          {t.hallTicketNo}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{exam?.title ?? "—"}</td>
                      <td className="px-4 py-3.5 text-slate-600">{formatDate(t.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GenerateHallTicketModal
        open={generateOpen}
        busy={busy}
        error={submitError}
        students={students}
        onClose={() => setGenerateOpen(false)}
        onSubmit={submitGenerate}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
