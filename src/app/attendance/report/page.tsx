"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PageTitle } from "@/components/attendance/AttendanceShell";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { EmptyState, ErrorState, InlineLoader, Spinner } from "@/components/admissions/States";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import { CourseOutcomeSet, fetchCourses } from "@/lib/obe";
import {
  AttendanceApiError,
  AttendanceRecordRow,
  canMarkAttendance,
  downloadCsv,
  fetchAttendanceReport,
  toCsv,
} from "@/lib/attendance";
import { AttendanceDetailModal } from "@/components/attendance/AttendanceDetailModal";

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

  const [rows, setRows] = useState<AttendanceRecordRow[]>([]);
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
    [isCentral, schoolId]
  );

  const handleCourseChange = (cid: string) => {
    setCourseId(cid);
    setStudentId("");
    setRows([]);
    setSelectedStudent(null);
    if (cid) loadReport(cid, "");
  };

  const handleStudentChange = (sid: string) => {
    if (courseId) loadReport(courseId, sid);
  };

  const studentOptions = Array.from(new Map(rows.map((r) => [r.studentId, r])).values());

  const exportCsv = () => {
    if (rows.length === 0) return;
    const csv = toCsv([
      ["Roll No", "Student", "Total Days", "Present Days", "Percentage"],
      ...rows.map((r) => [r.rollNo, r.name, r.totalDays, r.presentDays, r.percentage]),
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

      {coursesError && (
        <div className="mt-6">
          <ErrorState message={coursesError} onRetry={() => setProgramId((p) => p)} />
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
          <AttendanceTable rows={rows} onSelectRow={setSelectedStudent} />
        )}
      </div>

      <AttendanceDetailModal
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        courseId={courseId}
        schoolId={isCentral ? schoolId : undefined}
        canEdit={canEdit}
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
