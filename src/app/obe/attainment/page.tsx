"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, CheckCircle2 } from "lucide-react";
import { PageTitle } from "@/components/obe/ObEShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import { academicYearChoices } from "@/lib/fees";
import {
  calculateCourseAttainment,
  canEditObe,
  CourseOutcomeSet,
  enterAttainment,
  fetchAttainment,
  fetchCourses,
  ObeApiError,
} from "@/lib/obe";

const AY = academicYearChoices(4);

export default function ObeAttainmentPage() {
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
  const [academicYear, setAcademicYear] = useState(AY[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [average, setAverage] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

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

  const loadData = useCallback(async () => {
    if (!courseId || !selectedCourse) return;
    setDataLoading(true);
    setDataError(null);
    setAverage(null);
    setSaved(false);
    try {
      const records = await fetchAttainment({ courseId, academicYear });
      const next: Record<string, string> = {};
      for (const co of selectedCourse.cos) {
        next[co.id] = "";
      }
      for (const r of records) {
        if (next[r.coId] !== undefined) next[r.coId] = String(r.attainment);
      }
      setValues(next);
    } catch (e) {
      setDataError(e instanceof ObeApiError ? e.message : "Unable to load attainment data.");
    } finally {
      setDataLoading(false);
    }
  }, [courseId, selectedCourse, academicYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setValue = (coId: string, value: string) => {
    setValues((prev) => ({ ...prev, [coId]: value }));
    setSaved(false);
  };

  const numericValues = (selectedCourse?.cos || []).map((co) => {
    const raw = values[co.id] ?? "";
    const n = raw.trim() === "" ? NaN : Number(raw);
    return { coId: co.id, raw, n };
  });

  const hasInvalid = numericValues.some((v) => v.raw.trim() !== "" && (!Number.isFinite(v.n) || v.n < 0 || v.n > 100));
  const hasData = numericValues.some((v) => v.raw.trim() !== "");

  const calculate = () => {
    const nums = numericValues.filter((v) => v.raw.trim() !== "").map((v) => v.n);
    setAverage(calculateCourseAttainment(nums));
  };

  const save = async () => {
    if (!selectedCourse || hasInvalid) return;
    const entries = numericValues.filter((v) => v.raw.trim() !== "" && Number.isFinite(v.n));
    if (entries.length === 0) {
      setToast({ message: "Enter at least one attainment value.", type: "error" });
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await Promise.all(
        entries.map((v) =>
          enterAttainment({
            courseId: selectedCourse.courseId,
            coId: v.coId,
            academicYear,
            attainment: v.n,
            ...(schoolRequired && schoolId ? { schoolId } : {}),
          })
        )
      );
      setSaved(true);
      calculate();
      setToast({ message: "Attainment saved.", type: "success" });
    } catch (e) {
      setSubmitError(e instanceof ObeApiError ? e.message : "Unable to save attainment.");
    } finally {
      setBusy(false);
    }
  };

  const showToolbar = coursesLoading;
  const showEmptyCourses = !coursesLoading && !coursesError && courses.length === 0;

  return (
    <div>
      <PageTitle
        title="Attainment"
        subtitle="Enter per-CO attainment values (0–100) and calculate the course average."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {schoolRequired && <SchoolSelect value={schoolId} onChange={setSchoolId} />}
        <Field label="Program" htmlFor="obe-ay-program">
          <SelectInput id="obe-ay-program" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
            <option value="">All programs</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Course" htmlFor="obe-ay-course">
          <SelectInput id="obe-ay-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={showToolbar || showEmptyCourses}>
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.courseCode} — {c.courseTitle}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Academic year" htmlFor="obe-ay-year">
          <SelectInput id="obe-ay-year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {AY.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {coursesLoading ? (
        <LoadingSkeleton rows={3} />
      ) : coursesError ? (
        <ErrorState message={coursesError} onRetry={loadCourses} />
      ) : showEmptyCourses ? (
        <EmptyState
          title="No courses"
          description="No course-outcome sets are available. Define outcomes on the Course Outcomes screen first."
        />
      ) : !courseId ? (
        <EmptyState title="Select a course" description="Choose a course and academic year to enter attainment data." />
      ) : dataLoading ? (
        <LoadingSkeleton rows={3} />
      ) : dataError ? (
        <ErrorState message={dataError} onRetry={loadData} />
      ) : selectedCourse && selectedCourse.cos.length === 0 ? (
        <EmptyState title="No course outcomes" description="This course has no COs yet. Add them on the Course Outcomes screen." />
      ) : (
        <div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Course Outcome
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Attainment (0–100)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCourse?.cos ?? []).map((co) => {
                    const v = numericValues.find((x) => x.coId === co.id);
                    const invalid = v && v.raw.trim() !== "" && (!Number.isFinite(v.n) || v.n < 0 || v.n > 100);
                    return (
                      <tr key={co.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="text-xs font-black text-slate-800">{co.code}</div>
                          <div className="text-[11px] text-slate-500">{co.description}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={values[co.id] ?? ""}
                              onChange={(e) => setValue(co.id, e.target.value)}
                              disabled={!isFaculty || busy}
                              aria-label={`${co.code} attainment`}
                              className={`w-24 text-right text-xs font-bold rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 transition disabled:bg-slate-50 disabled:text-slate-500 ${
                                invalid
                                  ? "border-rose-300 bg-rose-50 text-rose-600 focus:ring-rose-400"
                                  : "border-slate-200 bg-white text-slate-800 focus:ring-indigo-500 focus:border-indigo-400"
                              }`}
                            />
                            {invalid && <span className="text-[10px] font-bold text-rose-600">0–100</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={calculate}
                disabled={!hasData || busy}
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Calculator className="h-3.5 w-3.5" /> Calculate average
              </button>

              {isFaculty ? (
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || hasInvalid}
                  className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Enter data"}
                </button>
              ) : (
                <span className="text-[11px] font-bold text-slate-400">Read-only view</span>
              )}
            </div>

            {average !== null && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Course CO attainment (average)</span>
                <span className="text-lg font-black text-indigo-700">{average.toFixed(2)} / 100</span>
              </div>
            )}

            {saved && isFaculty && (
              <p className="text-[11px] font-bold text-emerald-600">Attainment values saved for {academicYear}.</p>
            )}
            {submitError && (
              <p className="text-[11px] font-medium text-rose-600" role="alert">
                {submitError}
              </p>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
