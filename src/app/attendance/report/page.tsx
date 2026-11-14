"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarRange, Download } from "lucide-react";
import { PageTitle } from "@/components/attendance/AttendanceShell";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { EmptyState, ErrorState, InlineLoader, Spinner } from "@/components/admissions/States";
import { Field, SelectInput, TextInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import { CourseOutcomeSet, fetchCourses } from "@/lib/obe";
import {
  AttendanceAnalyticsWeek,
  AttendanceApiError,
  AttendanceRecordRow,
  canMarkAttendance,
  downloadCsv,
  fetchAttendanceAnalytics,
  fetchAttendanceReport,
  toCsv,
} from "@/lib/attendance";
import { AttendanceDetailModal } from "@/components/attendance/AttendanceDetailModal";

/** Simple stacked bar chart (present vs absent per week) built from plain divs. */
function WeekBarChart({ weeks }: { weeks: AttendanceAnalyticsWeek[] }) {
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.present, w.absent)));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Week-wise attendance</h3>
            <p className="text-[11px] text-slate-500">Present vs absent per week in the selected range.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Present
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Absent
          </span>
        </div>
      </div>
      <div className="flex items-end gap-3 overflow-x-auto pb-1 min-h-[140px]">
        {weeks.map((w) => {
          const presentH = Math.max(4, Math.round((w.present / max) * 96));
          const absentH = Math.max(4, Math.round((w.absent / max) * 96));
          return (
            <div key={w.weekLabel} className="flex flex-col items-center gap-2 shrink-0">
              <div className="flex items-end gap-0.5">
                <div
                  className="w-3.5 rounded-t-md bg-emerald-500"
                  style={{ height: presentH }}
                  title={`${w.weekLabel} — present ${w.present}`}
                />
                <div
                  className="w-3.5 rounded-t-md bg-rose-500"
                  style={{ height: absentH }}
                  title={`${w.weekLabel} — absent ${w.absent}`}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{w.weekLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AttendanceReportPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const isStudent = currentUser?.role === "STUDENT";
  const canEdit = canMarkAttendance(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [studentId, setStudentId] = useState("");

  const [selectedStudent, setSelectedStudent] = useState<AttendanceRecordRow | null>(null);

  const [courses, setCourses] = useState<CourseOutcomeSet[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [rows, setRows] = useState<AttendanceRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [weeks, setWeeks] = useState<AttendanceAnalyticsWeek[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ABSENT">("ALL");

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

  const loadReport = useCallback(
    async (cid: string, sid: string) => {
      if (!cid) return;
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchAttendanceReport({
          courseId: cid,
          studentId: sid || undefined,
          schoolId: isCentral ? schoolId : undefined,
          from: from || undefined,
          to: to || undefined,
        });
        setRows(data);
        setStudentId(sid);
      } catch (e) {
        setLoadError(e instanceof AttendanceApiError ? e.message : "Unable to load attendance report.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [isCentral, schoolId, from, to]
  );

  const loadAnalytics = useCallback(
    async (cid: string) => {
      if (!cid) return;
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const data = await fetchAttendanceAnalytics({
          courseId: cid,
          schoolId: isCentral ? schoolId : undefined,
          from: from || undefined,
          to: to || undefined,
        });
        setWeeks(data.weeks);
      } catch (e) {
        setAnalyticsError(e instanceof AttendanceApiError ? e.message : "Unable to load attendance analytics.");
        setWeeks([]);
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [isCentral, schoolId, from, to]
  );

  useEffect(() => {
    if (!courseId) {
      setRows([]);
      setWeeks([]);
      return;
    }
    void loadReport(courseId, studentId);
    void loadAnalytics(courseId);
  }, [courseId, studentId, from, to, loadReport, loadAnalytics]);

  const handleCourseChange = (cid: string) => {
    setCourseId(cid);
    setStudentId("");
    setRows([]);
    setWeeks([]);
    setSelectedStudent(null);
  };

  const handleStudentChange = (sid: string) => {
    setStudentId(sid);
  };

  const clearRange = () => {
    setFrom("");
    setTo("");
  };

  const studentOptions = Array.from(new Map(rows.map((r) => [r.studentId, r])).values());

  const exportCsv = () => {
    if (rows.length === 0) return;
    const csv = toCsv([
      ["Roll No", "Student", "Total Days", "Present Days", "Percentage", "Absent Dates"],
      ...rows.map((r) => [
        r.rollNo,
        r.name,
        r.totalDays,
        r.presentDays,
        r.percentage,
        (r.absentDates ?? []).join(", "),
      ]),
    ]);
    downloadCsv("attendance-report.csv", csv);
  };

  return (
    <div>
      <PageTitle
        title="Attendance Report"
        subtitle="Per-course attendance percentage by student."
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

      {isStudent && (
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs font-semibold text-indigo-700">
          You are viewing your own attendance record.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isCentral && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} label="School" htmlFor="report-school" />
        )}

        <Field label="Program" htmlFor="report-program">
          <SelectInput
            id="report-program"
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

        <Field label="Course" htmlFor="report-course">
          {coursesLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-400">
              <InlineLoader label="Loading courses…" />
            </div>
          ) : (
            <SelectInput
              id="report-course"
              value={courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
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

        <Field label="Student (optional)" htmlFor="report-student">
          <SelectInput
            id="report-student"
            value={studentId}
            onChange={(e) => handleStudentChange(e.target.value)}
            disabled={rows.length === 0}
          >
            <option value="">All students</option>
            {studentOptions.map((r) => (
              <option key={r.studentId} value={r.studentId}>
                {r.rollNo} — {r.name}
              </option>
            ))}
          </SelectInput>
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
          <Field label="From" htmlFor="report-from">
            <TextInput
              id="report-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="report-to">
            <TextInput
              id="report-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <button
            type="button"
            onClick={clearRange}
            disabled={!from && !to}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Clear
          </button>
          <p className="text-[11px] text-slate-400 sm:ml-auto">
            Leave empty for all records. Totals and absent dates apply only to the chosen window.
          </p>
        </div>
      </div>

      {coursesError && (
        <div className="mt-6">
          <ErrorState message={coursesError} onRetry={() => setProgramId((p) => p)} />
        </div>
      )}

      {courseId && (
        <div className="mt-6">
          {analyticsLoading ? (
            <Spinner label="Loading attendance analytics…" />
          ) : analyticsError ? (
            <ErrorState message={analyticsError} onRetry={() => loadAnalytics(courseId)} />
          ) : weeks.length === 0 ? (
            <EmptyState
              title="No analytics in this range"
              description="No weekly attendance data exists for this course in the selected window."
            />
          ) : (
            <WeekBarChart weeks={weeks} />
          )}
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <Spinner label="Loading attendance report…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => courseId && loadReport(courseId, studentId)} />
        ) : !courseId ? (
          <EmptyState
            title="Select a course"
            description="Choose a program and course to view the attendance report."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No attendance recorded"
            description="No attendance records exist for this course yet."
          />
        ) : (
          <AttendanceTable
            rows={rows}
            onSelectRow={(row) => {
              setStatusFilter("ALL");
              setSelectedStudent(row);
            }}
            onAbsentClick={(row) => {
              setStatusFilter("ABSENT");
              setSelectedStudent(row);
            }}
          />
        )}
      </div>

      <AttendanceDetailModal
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        courseId={courseId}
        schoolId={isCentral ? schoolId : undefined}
        canEdit={canEdit}
        initialStatus={statusFilter}
        student={
          selectedStudent
            ? {
              studentId: selectedStudent.studentId,
              rollNo: selectedStudent.rollNo,
              name: selectedStudent.name,
            }
            : null
        }
      />
    </div>
  );
}
