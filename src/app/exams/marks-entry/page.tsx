"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Inbox } from "lucide-react";
import { PageTitle } from "@/components/exams/ExamsShell";
import { ExamPicker } from "@/components/exams/ExamPicker";
import { GradeBadge } from "@/components/exams/ExamBadges";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton, InlineLoader } from "@/components/admissions/States";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { useUniversity } from "@/context/UniversityContext";
import { fullName, fetchStudents, StudentSummary } from "@/lib/students";
import {
  canEnterMarks,
  computeGradeForPercentage,
  computeTotalMarks,
  ExamsApiError,
  ExamDetail,
  ExamSchedule,
  fetchExam,
  fetchMarks,
  saveMarks,
  MarksEntry,
} from "@/lib/exams";

interface GridRow {
  studentId: string;
  rollNo: string;
  name: string;
  internal: string;
  external: string;
  originalInternal: number | null;
  originalExternal: number | null;
}

const FIELD_INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400";

function hasInvalidMarks(rows: GridRow[], exam: ExamDetail): boolean {
  for (const row of rows) {
    const internal = row.internal.trim() === "" ? null : Number(row.internal);
    const external = row.external.trim() === "" ? null : Number(row.external);
    if (internal !== null && (Number.isNaN(internal) || internal < 0 || internal > exam.maxInternal)) {
      return true;
    }
    if (external !== null && (Number.isNaN(external) || external < 0 || external > exam.maxExternal)) {
      return true;
    }
  }
  return false;
}

export default function MarksEntryPage() {
  const { currentUser } = useUniversity();
  const role = currentUser?.role;
  const canEdit = canEnterMarks(role);

  const [examId, setExamId] = useState("");
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [scheduleId, setScheduleId] = useState("");
  const [rows, setRows] = useState<GridRow[]>([]);

  const [loadingExam, setLoadingExam] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load exam meta + schedules once an exam is chosen.
  const loadExam = useCallback(async () => {
    if (!examId) return;
    setLoadingExam(true);
    setExamError(null);
    try {
      const detail = await fetchExam(examId);
      setExam(detail);
      setScheduleId("");
      setRows([]);
    } catch (e) {
      setExamError(e instanceof ExamsApiError ? e.message : "Unable to load exam.");
    } finally {
      setLoadingExam(false);
    }
  }, [examId]);

  useEffect(() => {
    loadExam();
  }, [loadExam]);

  // Load grid (students + existing marks) once an exam + schedule are chosen.
  const loadGrid = useCallback(async () => {
    if (!examId || !scheduleId || !exam) return;
    setLoadingGrid(true);
    setGridError(null);
    try {
      const [studentList, marksList] = await Promise.all([
        fetchStudents({ programId: exam.programId }),
        fetchMarks(examId, { scheduleId }),
      ]);
      const marksByStudent = new Map<string, MarksEntry>();
      for (const m of marksList) marksByStudent.set(m.studentId, m);
      const next: GridRow[] = studentList.map((s: StudentSummary) => {
        const existing = marksByStudent.get(s.id);
        return {
          studentId: s.id,
          rollNo: s.rollNo,
          name: fullName(s),
          internal: existing ? String(existing.internalMarks) : "",
          external: existing ? String(existing.externalMarks) : "",
          originalInternal: existing ? existing.internalMarks : null,
          originalExternal: existing ? existing.externalMarks : null,
        };
      });
      setRows(next);
    } catch (e) {
      setGridError(e instanceof ExamsApiError ? e.message : "Unable to load marks.");
    } finally {
      setLoadingGrid(false);
    }
  }, [examId, scheduleId, exam]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const updateRow = (studentId: string, field: "internal" | "external", value: string) => {
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, [field]: value } : r)));
  };

  const isDirty = (row: GridRow): boolean => {
    const internal = row.internal.trim() === "" ? null : Number(row.internal);
    const external = row.external.trim() === "" ? null : Number(row.external);
    return internal !== row.originalInternal || external !== row.originalExternal;
  };

  const saveAll = async () => {
    if (!examId || !scheduleId) return;
    if (hasInvalidMarks(rows, exam!)) {
      setToast({ message: "Marks exceed max internal/external limits.", type: "error" });
      return;
    }
    const dirty = rows.filter(isDirty);
    if (dirty.length === 0) {
      setToast({ message: "No changes to save.", type: "error" });
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      for (const row of dirty) {
        await saveMarks(examId, {
          studentId: row.studentId,
          scheduleId,
          internalMarks: row.internal.trim() === "" ? 0 : Number(row.internal),
          externalMarks: row.external.trim() === "" ? 0 : Number(row.external),
        });
      }
      setToast({ message: `Saved ${dirty.length} mark entr${dirty.length === 1 ? "y" : "ies"}.`, type: "success" });
      await loadGrid();
    } catch (e) {
      const message = e instanceof ExamsApiError ? e.message : "Unable to save marks.";
      setSubmitError(message);
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const schedules = exam?.schedules ?? [];

  return (
    <div>
      <PageTitle
        title="Marks Entry"
        subtitle="Enter internal and external marks per student and course."
        action={
          canEdit && exam && scheduleId && rows.length > 0 ? (
            <button
              type="button"
              onClick={saveAll}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {busy ? <InlineLoader label="Saving…" /> : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 max-w-3xl">
        <ExamPicker value={examId} onChange={setExamId} disabled={busy} />
        <Field label="Course" htmlFor="marks-schedule">
          <SelectInput
            id="marks-schedule"
            value={scheduleId}
            onChange={(e) => setScheduleId(e.target.value)}
            disabled={busy || !examId}
          >
            <option value="">Select course</option>
            {schedules.map((s: ExamSchedule) => (
              <option key={s.id} value={s.id}>
                {s.courseCode} — {s.courseTitle}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {!examId ? (
        <EmptyState title="Select an exam" description="Choose an exam and a course to enter marks." />
      ) : loadingExam ? (
        <LoadingSkeleton rows={4} />
      ) : examError ? (
        <ErrorState message={examError} onRetry={loadExam} />
      ) : !exam ? (
        <ErrorState message="Exam data is unavailable." onRetry={loadExam} />
      ) : schedules.length === 0 ? (
        <EmptyState
          title="No schedules"
          description="Add course schedules first before entering marks."
        />
      ) : !scheduleId ? (
        <EmptyState title="Select a course" description="Pick a course from the exam's schedules to load the marks grid." />
      ) : loadingGrid ? (
        <LoadingSkeleton rows={6} />
      ) : gridError ? (
        <ErrorState message={gridError} onRetry={loadGrid} />
      ) : rows.length === 0 ? (
        <EmptyState title="No marks due" description="No students are enrolled for this exam's program." />
      ) : (
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50/80">
                    <th className="px-4 py-3 font-bold">Roll No</th>
                    <th className="px-4 py-3 font-bold">Student</th>
                    <th className="px-4 py-3 font-bold text-right">Internal (max {exam.maxInternal})</th>
                    <th className="px-4 py-3 font-bold text-right">External (max {exam.maxExternal})</th>
                    <th className="px-4 py-3 font-bold text-right">Total</th>
                    <th className="px-4 py-3 font-bold text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const internal = row.internal.trim() === "" ? null : Number(row.internal);
                    const external = row.external.trim() === "" ? null : Number(row.external);
                    const total =
                      internal !== null || external !== null ? computeTotalMarks(internal ?? 0, external ?? 0) : null;
                    const percentage =
                      total !== null ? (total / (exam.maxInternal + exam.maxExternal)) * 100 : null;
                    const grade = percentage !== null ? computeGradeForPercentage(percentage) : null;
                    return (
                      <tr key={row.studentId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{row.rollNo}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={exam.maxInternal}
                            value={row.internal}
                            disabled={!canEdit || busy}
                            onChange={(e) => updateRow(row.studentId, "internal", e.target.value)}
                            className={FIELD_INPUT}
                            aria-label={`Internal marks for ${row.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={exam.maxExternal}
                            value={row.external}
                            disabled={!canEdit || busy}
                            onChange={(e) => updateRow(row.studentId, "external", e.target.value)}
                            className={FIELD_INPUT}
                            aria-label={`External marks for ${row.name}`}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{total ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {grade ? <GradeBadge grade={grade} /> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {!canEdit && (
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Inbox className="h-3.5 w-3.5" />
              You have read-only access to marks.
            </p>
          )}

          {submitError && (
            <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
              {submitError}
            </p>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
