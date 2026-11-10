"use client";

import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageTitle } from "@/components/obe/ObEShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import {
  canEditObe,
  CourseOutcomeSet,
  fetchCourses,
  fetchMappings,
  fetchProgramOutcomes,
  normalizeWeight,
  ObeApiError,
  ProgramOutcome,
  saveMappings,
  sumCoWeight,
  MappingWeightDraft,
} from "@/lib/obe";

export default function ObeMappingsPage() {
  const { currentUser } = useUniversity();
  const isFaculty = canEditObe(currentUser?.role);
  const isCentral = currentUser?.schoolId === "ALL";
  const schoolRequired = isCentral && isFaculty;

  const [schoolId, setSchoolId] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [courses, setCourses] = useState<CourseOutcomeSet[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [courseId, setCourseId] = useState("");
  const [pos, setPos] = useState<ProgramOutcome[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, Record<string, string>>>({});

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const selectedCourse = courses.find((c) => c.courseId === courseId) || null;

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    setCoursesError(null);
    try {
      const list = await fetchCourses(programFilter || undefined);
      setCourses(list);
      setCourseId((prev) => (list.some((c) => c.courseId === prev) ? prev : ""));
    } catch (e) {
      setCoursesError(e instanceof ObeApiError ? e.message : "Unable to load courses.");
    } finally {
      setCoursesLoading(false);
    }
  }, [programFilter]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const loadMatrix = useCallback(async () => {
    if (!courseId || !selectedCourse) return;
    setMatrixLoading(true);
    setMatrixError(null);
    try {
      const [posList, mappingRows] = await Promise.all([
        fetchProgramOutcomes(selectedCourse.programId),
        fetchMappings(courseId),
      ]);
      setPos(posList);
      const next: Record<string, Record<string, string>> = {};
      for (const co of selectedCourse.cos) {
        next[co.id] = {};
      }
      for (const m of mappingRows) {
        if (next[m.coId]) next[m.coId][m.poId] = String(m.weight);
      }
      setWeights(next);
    } catch (e) {
      setMatrixError(e instanceof ObeApiError ? e.message : "Unable to load mapping.");
    } finally {
      setMatrixLoading(false);
    }
  }, [courseId, selectedCourse]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const setWeight = (coId: string, poId: string, value: string) => {
    setWeights((prev) => ({
      ...prev,
      [coId]: { ...(prev[coId] || {}), [poId]: value },
    }));
  };

  const weightDrafts: MappingWeightDraft[] = [];
  for (const co of selectedCourse?.cos || []) {
    for (const po of pos) {
      const raw = weights[co.id]?.[po.id] ?? "";
      const parsed = raw.trim() === "" ? 0 : Number(raw);
      weightDrafts.push({ coId: co.id, poId: po.id, weight: normalizeWeight(parsed) });
    }
  }

  const invalidCells = (selectedCourse?.cos || []).some((co) =>
    pos.some((po) => {
      const raw = weights[co.id]?.[po.id] ?? "";
      if (raw.trim() === "") return false;
      const n = Number(raw);
      return !Number.isFinite(n) || n < 0 || n > 1;
    })
  );

  const save = async () => {
    if (invalidCells || !selectedCourse) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await saveMappings({
        courseId: selectedCourse.courseId,
        mappings: weightDrafts,
        ...(schoolRequired && schoolId ? { schoolId } : {}),
      });
      setToast({ message: "Mapping saved.", type: "success" });
      loadMatrix();
    } catch (e) {
      setSubmitError(e instanceof ObeApiError ? e.message : "Unable to save mapping.");
    } finally {
      setBusy(false);
    }
  };

  const showToolbar = coursesLoading;
  const showEmptyCourses = !coursesLoading && !coursesError && courses.length === 0;

  return (
    <div>
      <PageTitle
        title="CO–PO Mapping"
        subtitle="Set the strength of the relationship between each course outcome and program outcome."
      />

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
        {schoolRequired && <SchoolSelect value={schoolId} onChange={setSchoolId} />}
        <Field label="Program" htmlFor="obe-map-program">
          <SelectInput id="obe-map-program" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="sm:w-72">
            <option value="">All programs</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Course" htmlFor="obe-map-course">
          <SelectInput
            id="obe-map-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="sm:w-80"
            disabled={showToolbar || showEmptyCourses}
          >
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.courseCode} — {c.courseTitle}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {coursesLoading ? (
        <LoadingSkeleton rows={4} />
      ) : coursesError ? (
        <ErrorState message={coursesError} onRetry={loadCourses} />
      ) : showEmptyCourses ? (
        <EmptyState
          title="No courses"
          description="No course-outcome sets are available. Define outcomes on the Course Outcomes screen first."
        />
      ) : !courseId ? (
        <EmptyState title="Select a course" description="Choose a course to view its CO–PO mapping matrix." />
      ) : matrixLoading ? (
        <LoadingSkeleton rows={4} />
      ) : matrixError ? (
        <ErrorState message={matrixError} onRetry={loadMatrix} />
      ) : selectedCourse && selectedCourse.cos.length === 0 ? (
        <EmptyState title="No course outcomes" description="This course has no COs yet. Add them on the Course Outcomes screen." />
      ) : pos.length === 0 ? (
        <EmptyState title="No mapping" description="No program outcomes (POs) are defined for this course's program. Mapping columns come from POs." />
      ) : (
        <div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Course Outcomes
                    </th>
                    {pos.map((po) => (
                      <th key={po.id} className="text-center px-3 py-3 text-xs font-black text-indigo-700 min-w-[76px]">
                        <div>{po.code}</div>
                        <div className="font-medium text-[10px] text-slate-400 font-normal">{po.description}</div>
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Σ CO
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCourse?.cos ?? []).map((co) => {
                    const coWeight = weightDrafts.filter((w) => w.coId === co.id);
                    return (
                      <tr key={co.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="text-xs font-black text-slate-800">{co.code}</div>
                          <div className="text-[11px] text-slate-500">{co.description}</div>
                        </td>
                        {pos.map((po) => {
                          const raw = weights[co.id]?.[po.id] ?? "";
                          const invalid = raw.trim() !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 1);
                          return (
                            <td key={po.id} className="px-2 py-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.1}
                                value={raw}
                                onChange={(e) => setWeight(co.id, po.id, e.target.value)}
                                disabled={!isFaculty || busy}
                                aria-label={`${co.code} → ${po.code} weight`}
                                className={`w-16 text-center text-xs font-bold rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 transition disabled:bg-slate-50 disabled:text-slate-500 ${
                                  invalid
                                    ? "border-rose-300 bg-rose-50 text-rose-600 focus:ring-rose-400"
                                    : "border-slate-200 bg-white text-slate-800 focus:ring-indigo-500 focus:border-indigo-400"
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-3">
                          <span className="inline-flex text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg px-2.5 py-1">
                            {sumCoWeight(coWeight).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              Weights range 0–1. Blank cells count as 0. Σ CO is the total mapped weight per outcome.
            </p>
            {isFaculty ? (
              <button
                type="button"
                onClick={save}
                disabled={busy || invalidCells}
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save mapping"}
              </button>
            ) : (
              <span className="text-[11px] font-bold text-slate-400">Read-only view</span>
            )}
          </div>

          {submitError && (
            <p className="mt-3 text-[11px] font-medium text-rose-600" role="alert">
              {submitError}
            </p>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
