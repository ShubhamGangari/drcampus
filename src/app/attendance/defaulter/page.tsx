"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PageTitle } from "@/components/attendance/AttendanceShell";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { EmptyState, ErrorState, InlineLoader, Spinner } from "@/components/admissions/States";
import { Field, SelectInput, TextInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import { CourseOutcomeSet, fetchCourses } from "@/lib/obe";
import {
  AttendanceApiError,
  AttendanceRecordRow,
  canViewDefaulter,
  downloadCsv,
  fetchDefaulter,
  toCsv,
} from "@/lib/attendance";

const DEFAULT_THRESHOLD = "75";

export default function AttendanceDefaulterPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const permitted = canViewDefaulter(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [thresholdInput, setThresholdInput] = useState(DEFAULT_THRESHOLD);

  const [courses, setCourses] = useState<CourseOutcomeSet[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [rows, setRows] = useState<AttendanceRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const threshold = Number(thresholdInput);
  const thresholdValid = Number.isFinite(threshold) && threshold > 0 && threshold <= 100;

  useEffect(() => {
    if (!programId) {
      setCourses([]);
      setCourseId("");
      setCoursesLoading(false);
      setCoursesError(null);
      return;
    }
    let cancelled = false;
    setCoursesLoading(true);
    setCoursesError(null);
    fetchCourses(programId)
      .then((list) => {
        if (cancelled) return;
        setCourses(list);
        setCourseId((prev) => (list.some((c) => c.courseId === prev) ? prev : ""));
      })
      .catch((e) => {
        if (cancelled) return;
        setCoursesError(e instanceof Error ? e.message : "Unable to load courses.");
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const loadDefaulter = useCallback(
    async (cid: string, t: number) => {
      if (!cid || !Number.isFinite(t)) return;
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchDefaulter({
          courseId: cid,
          threshold: t,
          schoolId: isCentral ? schoolId : undefined,
        });
        setRows(data);
      } catch (e) {
        setLoadError(e instanceof AttendanceApiError ? e.message : "Unable to load defaulter list.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [isCentral, schoolId]
  );

  useEffect(() => {
    if (courseId && thresholdValid) {
      loadDefaulter(courseId, threshold);
    } else if (!courseId) {
      setRows([]);
    }
  }, [courseId, threshold, thresholdValid, loadDefaulter]);

  const exportCsv = () => {
    if (rows.length === 0) return;
    const csv = toCsv([
      ["Roll No", "Student", "Total Days", "Present Days", "Percentage"],
      ...rows.map((r) => [r.rollNo, r.name, r.totalDays, r.presentDays, r.percentage]),
    ]);
    downloadCsv("attendance-defaulters.csv", csv);
  };

  if (!permitted) {
    return (
      <div>
        <PageTitle title="Defaulter List" subtitle="Students below a minimum attendance threshold." />
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold text-slate-900">Access required</p>
          <p className="text-xs text-slate-500 mt-1">
            Faculty, deans and registrar administrators can view the defaulter list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Defaulter List"
        subtitle="Students with attendance below the selected threshold."
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isCentral && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} label="School" htmlFor="defaulter-school" />
        )}

        <Field label="Program" htmlFor="defaulter-program">
          <SelectInput
            id="defaulter-program"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            <option value="">Select program</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Course" htmlFor="defaulter-course">
          {coursesLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-400">
              <InlineLoader label="Loading courses…" />
            </div>
          ) : (
            <SelectInput
              id="defaulter-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={!programId}
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.courseCode} — {c.courseTitle}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <Field
          label="Threshold (%)"
          htmlFor="defaulter-threshold"
          hint="Students below this percentage are flagged."
          error={thresholdInput !== "" && !thresholdValid ? "Enter a threshold between 1 and 100." : undefined}
        >
          <TextInput
            id="defaulter-threshold"
            type="number"
            min={1}
            max={100}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
          />
        </Field>
      </div>

      {coursesError && (
        <div className="mt-6">
          <ErrorState message={coursesError} onRetry={() => setProgramId((p) => p)} />
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <Spinner label="Loading defaulter list…" />
        ) : loadError ? (
          <ErrorState message={loadError} />
        ) : !courseId ? (
          <EmptyState
            title="Select a course"
            description="Choose a program and course to find defaulters."
          />
        ) : !thresholdValid ? (
          <EmptyState title="Set a threshold" description="Enter a threshold percentage to generate the list." />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No defaulters"
            description={`No students fall below ${threshold}% attendance for this course.`}
          />
        ) : (
          <AttendanceTable rows={rows} />
        )}
      </div>
    </div>
  );
}
