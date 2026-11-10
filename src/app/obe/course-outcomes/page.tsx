"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageTitle } from "@/components/obe/ObEShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import {
  CoEditorModal,
  CourseCard,
  EditCoModal,
} from "@/components/obe/CourseOutcomeModals";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import {
  attachCourseOutcomes,
  canEditObe,
  CourseOutcome,
  CourseOutcomeDraft,
  CourseOutcomeSet,
  ObeApiError,
  fetchCourses,
  updateCourseOutcome,
} from "@/lib/obe";

interface CoModalState {
  open: boolean;
  mode: "attach" | "add";
  course: CourseOutcomeSet | null;
}

interface EditCoState {
  open: boolean;
  course: CourseOutcomeSet | null;
  co: CourseOutcome | null;
}

export default function ObeCourseOutcomesPage() {
  const { currentUser } = useUniversity();
  const isFaculty = canEditObe(currentUser?.role);
  const isCentral = currentUser?.schoolId === "ALL";
  const schoolRequired = isCentral && isFaculty;

  const [programFilter, setProgramFilter] = useState("");
  const [rows, setRows] = useState<CourseOutcomeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [coModal, setCoModal] = useState<CoModalState>({ open: false, mode: "attach", course: null });
  const [editCo, setEditCo] = useState<EditCoState>({ open: false, course: null, co: null });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchCourses(programFilter || undefined);
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof ObeApiError ? e.message : "Unable to load courses.");
    } finally {
      setLoading(false);
    }
  }, [programFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const closeModals = () => {
    if (busy) return;
    setCoModal((s) => ({ ...s, open: false }));
    setEditCo((s) => ({ ...s, open: false }));
  };

  const runSubmit = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await fn();
      setToast({ message: successMsg, type: "success" });
      closeModals();
      load();
    } catch (e) {
      setSubmitError(e instanceof ObeApiError ? e.message : "Unable to save course outcomes.");
    } finally {
      setBusy(false);
    }
  };

  const handleAttach = (input: {
    schoolId?: string;
    courseId: string;
    cos: CourseOutcomeDraft[];
  }) =>
    runSubmit(
      () => attachCourseOutcomes(input).then(() => undefined),
      coModal.mode === "attach" ? "Course-outcome set attached." : "Course outcome added."
    );

  const handleEdit = (input: { code?: string; description?: string }) => {
    const { course, co } = editCo;
    if (!course || !co) return;
    runSubmit(
      () => updateCourseOutcome(course.courseId, co.id, input).then(() => undefined),
      "Course outcome updated."
    );
  };

  return (
    <div>
      <PageTitle
        title="Course Outcomes"
        subtitle="Define course outcomes per course, then map them to program outcomes."
        action={
          isFaculty ? (
            <button
              type="button"
              onClick={() => setCoModal({ open: true, mode: "attach", course: null })}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Attach CO Set
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <Field label="Program" htmlFor="obe-program-filter">
          <SelectInput id="obe-program-filter" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="sm:w-72">
            <option value="">All programs</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No courses"
          description={
            programFilter
              ? "No course-outcome sets exist for this program yet."
              : "No courses available. Attach a course-outcome set to get started."
          }
        />
      ) : (
        <div className="space-y-4">
          {rows.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isFaculty={isFaculty}
              onAddCo={() => setCoModal({ open: true, mode: "add", course })}
              onEditCo={(co) => setEditCo({ open: true, course, co })}
            />
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <CoEditorModal
        open={coModal.open}
        mode={coModal.mode}
        course={coModal.course}
        busy={busy}
        error={submitError}
        schoolRequired={schoolRequired}
        onClose={closeModals}
        onSubmit={handleAttach}
      />

      <EditCoModal
        open={editCo.open}
        course={editCo.course}
        co={editCo.co}
        busy={busy}
        error={submitError}
        onClose={closeModals}
        onSubmit={handleEdit}
      />
    </div>
  );
}
