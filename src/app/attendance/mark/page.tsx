"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, UserCheck, UserX, Clock, Award, HeartPulse, Sparkles, CheckCheck } from "lucide-react";
import { PageTitle } from "@/components/attendance/AttendanceShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, InlineLoader, Spinner } from "@/components/admissions/States";
import { Field, SelectInput, TextInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS, fetchStudents, StudentSummary } from "@/lib/students";
import { CourseOutcomeSet, fetchCourses } from "@/lib/obe";
import {
  AttendanceApiError,
  AttendanceStatus,
  canMarkAttendance,
  markAttendance,
} from "@/lib/attendance";

function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AttendanceMarkPage() {
  const { currentUser } = useUniversity();
  const isFaculty = canMarkAttendance(currentUser?.role);
  const isCentral = currentUser?.schoolId === "ALL";

  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(todayString());

  const [courses, setCourses] = useState<CourseOutcomeSet[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [roster, setRoster] = useState<StudentSummary[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load courses for the selected program.
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
        setCoursesError(e instanceof AttendanceApiError ? e.message : "Unable to load courses.");
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  // Load the roster (students of the course's program) once a program is picked.
  useEffect(() => {
    if (!programId) {
      setRoster([]);
      setRosterLoading(false);
      setRosterError(null);
      setStatuses({});
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    setRosterError(null);
    fetchStudents({ programId })
      .then((list) => {
        if (cancelled) return;
        setRoster(list);
        setStatuses(Object.fromEntries(list.map((s) => [s.id, "PRESENT" as AttendanceStatus])));
      })
      .catch((e) => {
        if (cancelled) return;
        setRosterError(e instanceof Error ? e.message : "Unable to load enrolled students.");
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const toggleStatus = useCallback(
    (studentId: string, status: AttendanceStatus) => {
      setStatuses((prev) => ({ ...prev, [studentId]: status }));
    },
    []
  );

  const markAll = useCallback(
    (status: AttendanceStatus) => {
      const next: Record<string, AttendanceStatus> = {};
      for (const s of roster) {
        next[s.id] = status;
      }
      setStatuses(next);
    },
    [roster]
  );

  const presentCount = roster.filter((s) => (statuses[s.id] ?? "PRESENT") === "PRESENT").length;
  const absentCount = roster.filter((s) => statuses[s.id] === "ABSENT").length;
  const lateCount = roster.filter((s) => statuses[s.id] === "LATE").length;
  const dutyCount = roster.filter((s) => statuses[s.id] === "DUTY_LEAVE" || statuses[s.id] === "MEDICAL_LEAVE").length;

  const canSave = isFaculty && !!courseId && !!date && roster.length > 0 && !saving;

  const handleSave = async () => {
    if (!isFaculty || !courseId || !date) return;
    if (isCentral && !schoolId) {
      setToast({ message: "Select a school to record attendance.", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const records = roster.map((s) => ({
        studentId: s.id,
        status: statuses[s.id] ?? "PRESENT",
      }));
      const res = await markAttendance({
        schoolId: isCentral ? schoolId : undefined,
        courseId,
        date,
        records,
      });
      setToast({ message: `Saved ${res.marked} attendance record${res.marked === 1 ? "" : "s"}.`, type: "success" });
    } catch (e) {
      setToast({
        message: e instanceof AttendanceApiError ? e.message : "Unable to save attendance.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isFaculty) {
    return (
      <div>
        <PageTitle title="Mark Attendance" subtitle="Daily roll-call for a course." />
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold text-slate-900">Faculty access required</p>
          <p className="text-xs text-slate-500 mt-1">Only Faculty can mark attendance.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Mark Attendance" subtitle="Record daily presence for a course." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isCentral && (
          <SchoolSelect
            value={schoolId}
            onChange={setSchoolId}
            label="School"
            htmlFor="mark-school"
            placeholder="Select school"
          />
        )}

        <Field label="Program" htmlFor="mark-program">
          <SelectInput
            id="mark-program"
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

        <Field label="Course" htmlFor="mark-course">
          {coursesLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-400">
              <InlineLoader label="Loading courses…" />
            </div>
          ) : (
            <SelectInput
              id="mark-course"
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

        <Field label="Date" htmlFor="mark-date" hint="Attendance is anchored to course + student + date.">
          <TextInput
            id="mark-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      {coursesError && (
        <div className="mt-6">
          <ErrorState message={coursesError} onRetry={() => setProgramId((p) => p)} />
        </div>
      )}

      <div className="mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-slate-900">Students Roster</h2>
            {roster.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {presentCount} Present
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {absentCount} Absent
                </span>
                {(lateCount > 0 || dutyCount > 0) && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {lateCount + dutyCount} OD/Late
                  </span>
                )}
              </div>
            )}
          </div>

          {roster.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => markAll("PRESENT")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> Mark All Present
              </button>
              <button
                type="button"
                onClick={() => markAll("ABSENT")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-colors cursor-pointer"
              >
                <UserX className="h-3.5 w-3.5 text-rose-600" /> Mark All Absent
              </button>
            </div>
          )}
        </div>

        {rosterLoading ? (
          <Spinner label="Loading enrolled students…" />
        ) : rosterError ? (
          <ErrorState message={rosterError} />
        ) : roster.length === 0 ? (
          <EmptyState
            title="No students in this program"
            description="Choose a program and course to see enrolled students for marking."
          />
        ) : (
          <>
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
                      <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roster.map((s) => {
                      const status = statuses[s.id] ?? "PRESENT";
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">
                            {s.rollNo}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-900 whitespace-nowrap">
                            {s.firstName} {s.lastName}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => toggleStatus(s.id, "PRESENT")}
                                aria-pressed={status === "PRESENT"}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors cursor-pointer ${
                                  status === "PRESENT"
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs"
                                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                <UserCheck className="h-3 w-3" /> Present
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStatus(s.id, "ABSENT")}
                                aria-pressed={status === "ABSENT"}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors cursor-pointer ${
                                  status === "ABSENT"
                                    ? "bg-rose-50 border-rose-300 text-rose-700 shadow-2xs"
                                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                <UserX className="h-3 w-3" /> Absent
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStatus(s.id, "LATE")}
                                aria-pressed={status === "LATE"}
                                title="Late arrival within grace period"
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors cursor-pointer ${
                                  status === "LATE"
                                    ? "bg-amber-50 border-amber-300 text-amber-700 shadow-2xs"
                                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                <Clock className="h-3 w-3" /> Late
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStatus(s.id, "DUTY_LEAVE")}
                                aria-pressed={status === "DUTY_LEAVE"}
                                title="On-Duty (representing university in Sports, Cultural, or Academics; counts towards 75% rule)"
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors cursor-pointer ${
                                  status === "DUTY_LEAVE"
                                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                <Award className="h-3 w-3" /> OD
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStatus(s.id, "MEDICAL_LEAVE")}
                                aria-pressed={status === "MEDICAL_LEAVE"}
                                title="Medical Leave (with verified medical certificate)"
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors cursor-pointer ${
                                  status === "MEDICAL_LEAVE"
                                    ? "bg-blue-50 border-blue-300 text-blue-700 shadow-2xs"
                                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                <HeartPulse className="h-3 w-3" /> Medical
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? <InlineLoader label="Saving…" /> : (
                  <>
                    <Save className="h-4 w-4" /> Save Attendance
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
