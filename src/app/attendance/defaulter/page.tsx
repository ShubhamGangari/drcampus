"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarRange, Download } from "lucide-react";
import { PageTitle } from "@/components/attendance/AttendanceShell";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, InlineLoader, Spinner } from "@/components/admissions/States";
import { Field, SelectInput, TextInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import { CourseOutcomeSet, fetchCourses } from "@/lib/obe";
import {
  AttendanceApiError,
  AttendanceRecordRow,
  canNotifyDefaulters,
  canViewDefaulter,
  downloadCsv,
  fetchDefaulter,
  notifyDefaulters,
  toCsv,
} from "@/lib/attendance";

const DEFAULT_THRESHOLD = "75";

export default function AttendanceDefaulterPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const permitted = canViewDefaulter(currentUser?.role);
  const canNotify = canNotifyDefaulters(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [thresholdInput, setThresholdInput] = useState(DEFAULT_THRESHOLD);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [courses, setCourses] = useState<CourseOutcomeSet[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [rows, setRows] = useState<AttendanceRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [notifying, setNotifying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
          from: from || undefined,
          to: to || undefined,
        });
        setRows(data);
      } catch (e) {
        setLoadError(e instanceof AttendanceApiError ? e.message : "Unable to load defaulter list.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [isCentral, schoolId, from, to]
  );

  const handleNotify = async () => {
    if (!canNotify || !courseId || !thresholdValid || notifying) return;
    setNotifying(true);
    try {
      const res = await notifyDefaulters({
        courseId,
        threshold,
        schoolId: isCentral ? schoolId : undefined,
      });
      setToast({
        message: `Notified ${res.notified} defaulter${res.notified === 1 ? "" : "s"}.`,
        type: "success",
      });
    } catch (e) {
      setToast({
        message: e instanceof AttendanceApiError ? e.message : "Unable to notify defaulters.",
        type: "error",
      });
    } finally {
      setNotifying(false);
    }
  };

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
          <div className="flex items-center gap-2">
            {canNotify && (
              <button
                type="button"
                onClick={handleNotify}
                disabled={!courseId || !thresholdValid || notifying}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {notifying ? <InlineLoader label="Notifying…" /> : (
                  <>
                    <BellRing className="h-3.5 w-3.5" /> Notify defaulters
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
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

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex items-center gap-2 sm:mt-6">
            <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <CalendarRange className="h-4 w-4 text-slate-500" />
            </div>
            <span className="text-xs font-black text-slate-700">Date range</span>
          </div>
          <Field label="From" htmlFor="defaulter-from">
            <TextInput
              id="defaulter-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="defaulter-to">
            <TextInput
              id="defaulter-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            disabled={!from && !to}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Clear
          </button>
        </div>
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

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
