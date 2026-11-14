"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Users } from "lucide-react";
import { PageTitle } from "@/components/attendance/AttendanceShell";
import { EmptyState, ErrorState, InlineLoader, Spinner } from "@/components/admissions/States";
import { Field, SelectInput, TextInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import { CourseOutcomeSet, fetchCourses } from "@/lib/obe";
import {
  AttendanceApiError,
  AttendanceRegister,
  AttendanceRegisterRow,
  canViewRegister,
  downloadCsv,
  fetchAttendanceRegister,
  toCsv,
} from "@/lib/attendance";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CellBadge({ cell }: { cell: "P" | "A" | null }) {
  if (cell === "P") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-black text-emerald-700">
        P
      </span>
    );
  }
  if (cell === "A") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-black text-rose-700">
        A
      </span>
    );
  }
  return <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 border border-slate-100" aria-hidden="true" />;
}

export default function AttendanceRegisterPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const permitted = canViewRegister(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [month, setMonth] = useState(currentMonth());

  const [courses, setCourses] = useState<CourseOutcomeSet[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [register, setRegister] = useState<AttendanceRegister | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const loadRegister = useCallback(
    async (cid: string, m: string, sid: string) => {
      if (!cid || !m) return;
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchAttendanceRegister({
          courseId: cid,
          month: m,
          schoolId: isCentral ? sid : undefined,
        });
        setRegister(data);
      } catch (e) {
        setLoadError(e instanceof AttendanceApiError ? e.message : "Unable to load attendance register.");
        setRegister(null);
      } finally {
        setLoading(false);
      }
    },
    [isCentral]
  );

  useEffect(() => {
    const canFetch = courseId && month && (!isCentral || schoolId);
    if (canFetch) {
      void loadRegister(courseId, month, schoolId);
    } else {
      setRegister(null);
    }
  }, [courseId, month, schoolId, isCentral, loadRegister]);

  const handleCourseChange = (cid: string) => {
    setCourseId(cid);
    setRegister(null);
  };

  const exportCsv = () => {
    if (!register || register.rows.length === 0) return;
    const csv = toCsv([
      ["Student", "Roll No", ...register.header, "Present", "Total", "Percentage", "Absent Dates"],
      ...register.rows.map((r: AttendanceRegisterRow) => [
        r.name,
        r.rollNo,
        ...r.cells.map((c) => c ?? ""),
        r.present,
        r.total,
        r.percentage,
        r.absentDates.join(", "),
      ]),
    ]);
    downloadCsv(`attendance-register-${month}.csv`, csv);
  };

  if (!permitted) {
    return (
      <div>
        <PageTitle title="Attendance Register" subtitle="Monthly attendance matrix for a course." />
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold text-slate-900">Access required</p>
          <p className="text-xs text-slate-500 mt-1">
            Faculty, deans and registrar administrators can view the attendance register.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Attendance Register"
        subtitle="Monthly student × date attendance matrix."
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={!register || register.rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isCentral && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} label="School" htmlFor="register-school" />
        )}

        <Field label="Program" htmlFor="register-program">
          <SelectInput
            id="register-program"
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

        <Field label="Course" htmlFor="register-course">
          {coursesLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-400">
              <InlineLoader label="Loading courses…" />
            </div>
          ) : (
            <SelectInput
              id="register-course"
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

        <Field label="Month" htmlFor="register-month" hint="Shows dates in this month that have records.">
          <TextInput
            id="register-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
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
          <Spinner label="Loading attendance register…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => loadRegister(courseId, month, schoolId)} />
        ) : !courseId ? (
          <EmptyState
            title="Select a course"
            description="Choose a program and course to view the monthly register."
          />
        ) : isCentral && !schoolId ? (
          <EmptyState
            title="Select a school"
            description="Choose a school to load the attendance register."
          />
        ) : !register || register.rows.length === 0 ? (
          <EmptyState
            title="No records this month"
            description={`No attendance was recorded for this course in ${month}.`}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700">P</span>
                  Present
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-black text-rose-700">A</span>
                  Absent
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg bg-slate-50 border border-slate-100" />
                  No class / not marked
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {register.rows.length} student{register.rows.length === 1 ? "" : "s"} × {register.header.length} date{register.header.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                        Roll No
                      </th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                        Student
                      </th>
                      {register.header.map((h) => (
                        <th
                          key={h}
                          className="px-2 py-3 text-center text-[11px] font-black text-slate-600 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">
                        Present
                      </th>
                      <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">
                        Total
                      </th>
                      <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">
                        %
                      </th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                        Absent Dates
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {register.rows.map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">
                          {row.rollNo}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {row.name}
                        </td>
                        {row.cells.map((cell, i) => (
                          <td key={`${row.studentId}-${i}`} className="px-2 py-3 text-center">
                            <CellBadge cell={cell} />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center text-xs font-black text-emerald-700 tabular-nums">
                          {row.present}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-600 tabular-nums">
                          {row.total}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-slate-800 tabular-nums">
                          {row.percentage}%
                        </td>
                        <td className="px-4 py-3 text-[11px] font-semibold text-rose-500">
                          {row.absentDates.length > 0 ? row.absentDates.join(", ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {register.teachers.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center">
                    <Users className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Marked by teachers</h3>
                    <p className="text-[11px] text-slate-500">Days marked per teacher, this month.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {register.teachers.map((t) => (
                    <div
                      key={t.teacherId}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5"
                    >
                      <span className="text-xs font-bold text-slate-800">{t.teacherName}</span>
                      <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-black text-slate-500 tabular-nums">
                        {t.markedCount} day{t.markedCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
