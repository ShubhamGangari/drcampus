"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, CalendarClock } from "lucide-react";
import { PageTitle } from "@/components/exams/ExamsShell";
import { ExamPicker } from "@/components/exams/ExamPicker";
import { ScheduleModal } from "@/components/exams/ScheduleModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
  AddScheduleInput,
  ExamDetail,
  ExamSchedule,
  ExamsApiError,
  fetchExam,
  addSchedule,
  updateSchedule,
  UpdateScheduleInput,
  formatDate,
  formatTime,
} from "@/lib/exams";

interface ModalState {
  open: boolean;
  mode: "create" | "edit";
  record: ExamSchedule | null;
}

function ExamsSchedulesPageContent() {
  const { currentUser } = useUniversity();
  const isExamController = currentUser?.role === "EXAM_CONTROLLER";

  const searchParams = useSearchParams();
  const initialExamId = searchParams.get("examId") ?? "";
  const [examId, setExamId] = useState(initialExamId);
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>({ open: false, mode: "create", record: null });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await fetchExam(examId);
      setExam(detail);
    } catch (e) {
      setLoadError(e instanceof ExamsApiError ? e.message : "Unable to load schedules.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (input: AddScheduleInput | UpdateScheduleInput, mode: "create" | "edit") => {
    if (!examId) return;
    setBusy(true);
    setSubmitError(null);
    try {
      if (mode === "edit" && modal.record) {
        await updateSchedule(examId, modal.record.id, input as UpdateScheduleInput);
        setToast({ message: "Schedule updated.", type: "success" });
      } else {
        await addSchedule(examId, input as AddScheduleInput);
        setToast({ message: "Schedule added.", type: "success" });
      }
      setModal({ open: false, mode: "create", record: null });
      load();
    } catch (e) {
      setSubmitError(e instanceof ExamsApiError ? e.message : "Unable to save schedule.");
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => setModal({ open: true, mode: "create", record: null });
  const openEdit = (record: ExamSchedule) => setModal({ open: true, mode: "edit", record });

  const schedules = exam?.schedules ?? [];

  return (
    <div>
      <PageTitle
        title="Schedules"
        subtitle="Per-exam course schedules with date, time and venue."
        action={
          isExamController && exam ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Schedule
            </button>
          ) : undefined
        }
      />

      <div className="max-w-md mb-5">
        <ExamPicker value={examId} onChange={setExamId} disabled={busy} />
      </div>

      {!examId ? (
        <EmptyState
          title="Select an exam"
          description="Choose an exam to view and manage its course schedules."
        />
      ) : loading ? (
        <LoadingSkeleton rows={4} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : schedules.length === 0 ? (
        <EmptyState
          title="No schedules"
          description="Add course schedules for this exam using the Add Schedule button."
          action={
            isExamController ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Schedule
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50/80">
                  <th className="px-4 py-3 font-bold">Course</th>
                  <th className="px-4 py-3 font-bold">Exam Date</th>
                  <th className="px-4 py-3 font-bold">Start Time</th>
                  <th className="px-4 py-3 font-bold">Venue</th>
                  {isExamController && <th className="px-4 py-3 font-bold text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{s.courseTitle}</p>
                      <p className="text-xs text-slate-500">{s.courseCode}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                        {formatDate(s.examDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{formatTime(s.startTime)}</td>
                    <td className="px-4 py-3.5 text-slate-600">{s.venue}</td>
                    {isExamController && (
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ScheduleModal
        open={modal.open}
        mode={modal.mode}
        record={modal.record}
        programId={exam?.programId ?? ""}
        semester={exam?.semester ?? 1}
        busy={busy}
        error={submitError}
        onClose={() => setModal({ open: false, mode: "create", record: null })}
        onSubmit={submit}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function ExamsSchedulesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading...</div>}>
      <ExamsSchedulesPageContent />
    </Suspense>
  );
}
