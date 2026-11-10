"use client";

import React, { useState, useEffect } from "react";
import { Student } from "@/types";
import { useUniversity } from "@/context/UniversityContext";
import {
  fetchExams,
  fetchSchedules,
  fetchMarks,
  saveMarks,
  publishResults,
  type Exam,
  type ExamSchedule,
  type MarksEntry,
  examTypeLabel,
  examStatusLabel,
} from "@/lib/exams";
import {
  Award,
  Printer,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Lock,
  X,
  Loader2,
} from "lucide-react";

interface ExamControllerWorkspaceProps {
  activeSchoolId?: string;
  activeSection?: string;
}

interface MarkRow extends MarksEntry {
  studentName: string;
  rollNo: string;
}

/** UGC 10-point point value for a letter grade. */
const pointForGrade = (grade: string | null): number => {
  switch (grade) {
    case "O":
      return 10;
    case "A+":
      return 9;
    case "A":
      return 8;
    case "B+":
      return 7;
    case "B":
      return 6;
    case "C":
      return 5;
    case "D":
      return 4;
    default:
      return 0;
  }
};

const letterClass = (grade: string): string => {
  if (grade === "O") return "bg-emerald-100 text-emerald-800";
  if (grade === "A+" || grade === "A") return "bg-blue-100 text-blue-800";
  if (grade === "F") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-800";
};

/** Local fallback grade (kept in sync with the on-screen UGC scale). */
const localGrade = (total: number): { grade: string; point: number } => {
  if (total >= 90) return { grade: "O", point: 10 };
  if (total >= 80) return { grade: "A+", point: 9 };
  if (total >= 70) return { grade: "A", point: 8 };
  if (total >= 60) return { grade: "B+", point: 7 };
  if (total >= 50) return { grade: "B", point: 6 };
  if (total >= 40) return { grade: "C", point: 5 };
  return { grade: "F", point: 0 };
};

export const ExamControllerWorkspace: React.FC<ExamControllerWorkspaceProps> = ({
  activeSchoolId = "ALL",
  activeSection = "tabulation",
}) => {
  const { students } = useUniversity();
  const schoolScopedStudents =
    activeSchoolId === "ALL"
      ? students
      : students.filter((s) => s.schoolId === activeSchoolId);

  const [activeTab, setActiveTab] = useState<"tabulation" | "grading" | "gazette" | "transcripts">("tabulation");

  // Live exams data
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [markRows, setMarkRows] = useState<MarkRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { internal: number; external: number }>>({});
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lockToast, setLockToast] = useState<string | null>(null);
  const [showMarksheetModal, setShowMarksheetModal] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<Student>(schoolScopedStudents[0] || students[0]);
  const [studentTranscript, setStudentTranscript] = useState<
    { courseCode: string; courseTitle: string; internalMarks: number; externalMarks: number; totalMarks: number; grade: string | null }[]
  >([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  useEffect(() => {
    if (activeSection === "grading") setActiveTab("grading");
    else if (activeSection === "gazette") setActiveTab("gazette");
    else if (activeSection === "transcripts") setActiveTab("transcripts");
    else setActiveTab("tabulation");
  }, [activeSection]);

  useEffect(() => {
    if (schoolScopedStudents.length > 0 && !schoolScopedStudents.some((s) => s.id === selectedStudent.id)) {
      setSelectedStudent(schoolScopedStudents[0]);
    }
  }, [activeSchoolId, schoolScopedStudents, selectedStudent.id]);

  // Load real exams once.
  useEffect(() => {
    let alive = true;
    fetchExams()
      .then((list) => {
        if (!alive) return;
        setExams(list);
        if (list.length > 0) setSelectedExamId(list[0].id);
      })
      .catch(() => {
        /* exams unavailable */
      })
      .finally(() => {
        if (alive) setLoadingExams(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Load schedules for the selected exam.
  useEffect(() => {
    if (!selectedExamId) {
      setSchedules([]);
      setSelectedScheduleId("");
      return;
    }
    let alive = true;
    fetchSchedules(selectedExamId)
      .then((list) => {
        if (!alive) return;
        setSchedules(list);
        setSelectedScheduleId(list.length > 0 ? list[0].id : "");
      })
      .catch(() => { });
    return () => {
      alive = false;
    };
  }, [selectedExamId]);

  // Load marks for the selected schedule, merged with the live student roster.
  useEffect(() => {
    if (!selectedExamId || !selectedScheduleId) {
      setMarkRows([]);
      setDrafts({});
      return;
    }
    let alive = true;
    setLoadingMarks(true);
    const scoped = activeSchoolId === "ALL" ? students : students.filter((s) => s.schoolId === activeSchoolId);
    fetchMarks(selectedExamId, { scheduleId: selectedScheduleId })
      .then((rows) => {
        if (!alive) return;
        const byStudent = new Map(rows.map((r) => [r.studentId, r]));
        const merged = scoped.map((st): MarkRow => {
          const r = byStudent.get(st.id);
          return r
            ? { ...r, studentName: st.fullName, rollNo: st.rollNo }
            : {
              id: "",
              studentId: st.id,
              scheduleId: selectedScheduleId,
              internalMarks: 0,
              externalMarks: 0,
              totalMarks: 0,
              grade: null,
              status: "",
              studentName: st.fullName,
              rollNo: st.rollNo,
            };
        });
        setMarkRows(merged);
        setDrafts({});
      })
      .catch(() => { })
      .finally(() => {
        if (alive) setLoadingMarks(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedExamId, selectedScheduleId, students, activeSchoolId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId) || null;
  const gazetteLocked = selectedExam?.status === "PUBLISHED";

  const handleUpdateMarks = async (studentId: string, internal: number, external: number) => {
    if (!selectedExam || !selectedScheduleId) return;
    const validInternal = Math.min(selectedExam.maxInternal, Math.max(0, internal));
    const validExternal = Math.min(selectedExam.maxExternal, Math.max(0, external));
    const total = validInternal + validExternal;

    // Optimistic update for immediate feedback.
    setMarkRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId
          ? { ...row, internalMarks: validInternal, externalMarks: validExternal, totalMarks: total }
          : row
      )
    );

    try {
      const res = await saveMarks(selectedExamId, {
        studentId,
        scheduleId: selectedScheduleId,
        internalMarks: validInternal,
        externalMarks: validExternal,
      });
      setMarkRows((prev) =>
        prev.map((row) =>
          row.studentId === studentId
            ? { ...row, totalMarks: res.totalMarks, grade: res.grade }
            : row
        )
      );
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save marks.");
    }
  };

  const setInternalDraft = (studentId: string, value: number) => {
    setDrafts((prev) => {
      const cur = prev[studentId] ?? {
        internal: markRows.find((r) => r.studentId === studentId)?.internalMarks ?? 0,
        external: markRows.find((r) => r.studentId === studentId)?.externalMarks ?? 0,
      };
      return { ...prev, [studentId]: { internal: value, external: cur.external } };
    });
  };

  const setExternalDraft = (studentId: string, value: number) => {
    setDrafts((prev) => {
      const cur = prev[studentId] ?? {
        internal: markRows.find((r) => r.studentId === studentId)?.internalMarks ?? 0,
        external: markRows.find((r) => r.studentId === studentId)?.externalMarks ?? 0,
      };
      return { ...prev, [studentId]: { internal: cur.internal, external: value } };
    });
  };

  const commitDraft = (studentId: string) => {
    const d = drafts[studentId];
    if (!d) return;
    handleUpdateMarks(studentId, d.internal, d.external);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  const handleLockGazette = async () => {
    if (!selectedExamId) return;
    try {
      await publishResults(selectedExamId);
      setExams((prev) => prev.map((e) => (e.id === selectedExamId ? { ...e, status: "PUBLISHED" } : e)));
      setLockToast("Official Result Gazette successfully locked and signed. Grades published to Student Portals.");
      setTimeout(() => setLockToast(null), 4000);
    } catch {
      setLockToast("Publishing failed. Please verify marks are complete.");
      setTimeout(() => setLockToast(null), 4000);
    }
  };

  // Fetch the selected student's transcript (all papers) when the marksheet modal opens.
  useEffect(() => {
    if (!showMarksheetModal || !selectedExamId || !selectedStudent) return;
    let alive = true;
    setLoadingTranscript(true);
    Promise.all([fetchMarks(selectedExamId, { studentId: selectedStudent.id }), fetchSchedules(selectedExamId)])
      .then(([marks, sched]) => {
        if (!alive) return;
        const schedById = new Map(sched.map((s) => [s.id, s]));
        const rows = marks.map((m) => {
          const sc = schedById.get(m.scheduleId);
          return {
            courseCode: sc?.courseCode ?? m.scheduleId,
            courseTitle: sc?.courseTitle ?? "",
            internalMarks: m.internalMarks,
            externalMarks: m.externalMarks,
            totalMarks: m.totalMarks,
            grade: m.grade,
          };
        });
        setStudentTranscript(rows);
      })
      .catch(() => { })
      .finally(() => {
        if (alive) setLoadingTranscript(false);
      });
    return () => {
      alive = false;
    };
  }, [showMarksheetModal, selectedExamId, selectedStudent]);

  const ugcScaleTable = [
    { grade: "O", point: 10, marks: "90 - 100", desc: "Outstanding (Top 5% Cohort)" },
    { grade: "A+", point: 9, marks: "80 - 89", desc: "Excellent" },
    { grade: "A", point: 8, marks: "70 - 79", desc: "Very Good" },
    { grade: "B+", point: 7, marks: "60 - 69", desc: "Good" },
    { grade: "B", point: 6, marks: "50 - 59", desc: "Above Average" },
    { grade: "C", point: 5, marks: "40 - 49", desc: "Pass" },
    { grade: "F", point: 0, marks: "Below 40", desc: "Fail / Reappear" },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {lockToast && (
        <div className="bg-emerald-600 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{lockToast}</span>
          </div>
          <button onClick={() => setLockToast(null)} className="ml-3 text-white/80 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Prof. (Dr.) Archana Prakash
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
              Controller of Examinations (COE)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tabulation Register (TR) • UGC 10-Point Scale Engine •{" "}
            {selectedExam
              ? `${examTypeLabel(selectedExam.type)} ${selectedExam.academicYear}`
              : "No examination selected"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            type="button"
            onClick={() => setShowMarksheetModal(true)}
            disabled={!selectedExamId || !selectedStudent}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Award className="h-3.5 w-3.5" />
            Generate Official Marksheet
          </button>
          {!gazetteLocked ? (
            <button
              type="button"
              onClick={handleLockGazette}
              disabled={!selectedExamId}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="h-3.5 w-3.5" />
              Lock & Publish Gazette
            </button>
          ) : (
            <span className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold text-xs flex items-center gap-1.5 border border-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Gazette Locked & Signed
            </span>
          )}
        </div>
      </div>

      {/* Main COE Workspace Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 px-6 pt-4 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("tabulation")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "tabulation"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              Tabulation Register (TR)
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("grading")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "grading"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              UGC 10-Point Scale Standard
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gazette")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "gazette"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <Lock className="h-4 w-4" />
              Gazette Signing Room ({gazetteLocked ? "Locked" : "Open"})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("transcripts")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "transcripts"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <Printer className="h-4 w-4" />
              Digital Grade Cards & Transcripts
            </span>
          </button>
        </div>

        {/* TAB 1: TABULATION REGISTER */}
        {activeTab === "tabulation" && (
          <div className="p-6 space-y-6">
            {/* Exam + Course Cockpit */}
            <div className="flex flex-col lg:flex-row gap-4 pb-4 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Examination</label>
                  <select
                    aria-label="Select examination"
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {loadingExams ? (
                      <option>Loading exams…</option>
                    ) : exams.length === 0 ? (
                      <option value="">No examinations found</option>
                    ) : (
                      exams.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title} • {examTypeLabel(e.type)} • Sem {e.semester} ({examStatusLabel(e.status)})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Course / Paper</label>
                  <select
                    aria-label="Select course paper"
                    value={selectedScheduleId}
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                    disabled={!selectedExamId || schedules.length === 0}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {schedules.length === 0 ? (
                      <option value="">No papers scheduled</option>
                    ) : (
                      schedules.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.courseCode} — {sc.courseTitle}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-xs shrink-0">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Students</span>
                  <span className="font-bold text-slate-900">{schoolScopedStudents.length}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Max IA / ESE</span>
                  <span className="font-bold text-slate-900">
                    {selectedExam ? `${selectedExam.maxInternal} / ${selectedExam.maxExternal}` : "—"}
                  </span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-bold text-slate-900">{selectedExam ? examStatusLabel(selectedExam.status) : "—"}</span>
                </div>
              </div>
            </div>

            {saveError && (
              <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {saveError}
              </div>
            )}

            {/* Marks Entry Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">
                      {selectedExam ? `Internal (${selectedExam.maxInternal})` : "Internal"}
                    </th>
                    <th className="px-4 py-3">
                      {selectedExam ? `External (${selectedExam.maxExternal})` : "External"}
                    </th>
                    <th className="px-4 py-3">Total (100)</th>
                    <th className="px-4 py-3">Grade Point</th>
                    <th className="px-4 py-3">Letter Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingMarks ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                        Loading marks…
                      </td>
                    </tr>
                  ) : markRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Select an examination and paper to begin data entry.
                      </td>
                    </tr>
                  ) : (
                    markRows.map((row) => {
                      const d = drafts[row.studentId];
                      const internal = d ? d.internal : row.internalMarks;
                      const external = d ? d.external : row.externalMarks;
                      const total = internal + external;
                      const grade = row.grade || localGrade(total).grade;
                      const point = pointForGrade(grade);
                      return (
                        <tr key={row.studentId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 block">{row.studentName}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{row.rollNo}</span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              aria-label={`Internal marks for ${row.studentName}`}
                              disabled={gazetteLocked}
                              value={internal}
                              onChange={(e) => setInternalDraft(row.studentId, Number(e.target.value))}
                              onBlur={() => commitDraft(row.studentId)}
                              className="w-16 px-2 py-1 rounded border border-slate-200 font-mono text-center text-xs disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              aria-label={`External marks for ${row.studentName}`}
                              disabled={gazetteLocked}
                              value={external}
                              onChange={(e) => setExternalDraft(row.studentId, Number(e.target.value))}
                              onBlur={() => commitDraft(row.studentId)}
                              className="w-16 px-2 py-1 rounded border border-slate-200 font-mono text-center text-xs disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 text-sm font-mono">{total}</td>
                          <td className="px-4 py-3 font-bold text-indigo-700 text-sm">{point}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${letterClass(grade)}`}>
                              {grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: UGC 10-POINT SCALE */}
        {activeTab === "grading" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  UGC 10-Point Relative Grading System (Statutory Scale)
                </h3>
                <p className="text-xs text-slate-500">
                  Applicable across all undergraduate and postgraduate degrees at SRHU under CBCS regulations.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                UGC Standard
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Letter Grade</th>
                    <th className="px-4 py-3">Grade Point</th>
                    <th className="px-4 py-3">Percentage Marks Range</th>
                    <th className="px-4 py-3">Performance Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {ugcScaleTable.map((scale, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-bold text-sm text-indigo-700">{scale.grade}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{scale.point}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{scale.marks}</td>
                      <td className="px-4 py-3 text-slate-600">{scale.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: RESULT GAZETTE */}
        {activeTab === "gazette" && (
          <div className="p-6 space-y-5">
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {selectedExam ? `${selectedExam.title} Result Gazette` : "University Result Gazette"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Autonomous Examination Cell • Swami Rama Himalayan University (SRHU)
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${gazetteLocked
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}
                >
                  {gazetteLocked ? "✓ Gazette Signed & Published" : "⏳ Pending Digital Lock"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Examination</span>
                  <span className="font-semibold text-slate-800">
                    {selectedExam ? `${examTypeLabel(selectedExam.type)} • Sem ${selectedExam.semester}` : "—"}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Authorized Signatory</span>
                  <span className="font-bold text-slate-800">Prof. (Dr.) Archana Prakash (COE)</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Release Date</span>
                  <span className="font-medium text-slate-800">
                    {gazetteLocked ? `Published (${examStatusLabel(selectedExam.status)})` : "Not yet published"}
                  </span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-200">
                <p className="text-xs text-slate-600">
                  {gazetteLocked
                    ? "Grades are sealed and tamper-evident. Student grade cards are active."
                    : "Review all constituent school marks before freezing and locking the official gazette."}
                </p>
                {!gazetteLocked && (
                  <button
                    type="button"
                    onClick={handleLockGazette}
                    disabled={!selectedExamId}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Lock & Publish Gazette
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TRANSCRIPTS */}
        {activeTab === "transcripts" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Official Digital Grade Cards & Transcripts
                </h3>
                <p className="text-xs text-slate-500">
                  Select a candidate below to print their verified SRHU Semester Marksheet with QR verification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {schoolScopedStudents.map((st) => (
                <div key={st.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{st.fullName}</span>
                    <span className="font-mono text-[10px] text-slate-500">{st.rollNo}</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Enrollment:</span>
                      <strong>{st.enrollmentNo}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Semester:</span>
                      <strong>{st.currentSemester}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(st);
                      setShowMarksheetModal(true);
                    }}
                    disabled={!selectedExamId}
                    className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>View & Print Marksheet</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Official Marksheet Modal */}
      {showMarksheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-300 shadow-2xl p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-slate-900 text-white font-black text-lg flex items-center justify-center">
                  SRHU
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">SWAMI RAMA HIMALAYAN UNIVERSITY</h3>
                  <p className="text-xs text-slate-500 font-medium">Jolly Grant, Dehradun - 248016 | NAAC Grade A+</p>
                  <p className="text-xs font-bold text-indigo-700 uppercase mt-0.5">
                    OFFICIAL GRADE TRANSCRIPT •{" "}
                    {selectedExam ? `${examTypeLabel(selectedExam.type).toUpperCase()} ${selectedExam.academicYear}` : "RESULT"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setShowMarksheetModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Candidate Header Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Candidate</span>
                <span className="font-bold text-slate-900">{selectedStudent.fullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Enrollment No</span>
                <span className="font-mono font-bold text-slate-900">{selectedStudent.enrollmentNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">University Roll</span>
                <span className="font-mono font-bold text-slate-900">{selectedStudent.rollNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Semester</span>
                <span className="font-semibold text-slate-900">{selectedStudent.currentSemester}</span>
              </div>
            </div>

            {/* Courses & Grades Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Course Code</th>
                    <th className="py-2.5 px-3">Course Title</th>
                    <th className="py-2.5 px-3">Internal</th>
                    <th className="py-2.5 px-3">External</th>
                    <th className="py-2.5 px-3">Total Marks</th>
                    <th className="py-2.5 px-3">Letter Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTranscript ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                        Loading transcript…
                      </td>
                    </tr>
                  ) : studentTranscript.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No marks recorded for this candidate.
                      </td>
                    </tr>
                  ) : (
                    studentTranscript.map((m, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-3 font-mono font-bold">{m.courseCode}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{m.courseTitle}</td>
                        <td className="py-2.5 px-3">{m.internalMarks}</td>
                        <td className="py-2.5 px-3">{m.externalMarks}</td>
                        <td className="py-2.5 px-3 font-bold font-mono">{m.totalMarks}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${letterClass(m.grade || "")}`}>
                            {m.grade || "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary & Signatures */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs">
              <div>
                <p className="font-bold text-slate-900">
                  CGPA: {selectedStudent.academicPerformance.cgpa.toFixed(2)}
                </p>
                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                  Result: PASSED (First Class with Distinction)
                </p>
              </div>

              <div className="text-right flex items-center gap-4">
                <QrCode className="h-10 w-10 text-slate-900" />
                <div>
                  <p className="font-serif italic font-bold text-sm text-slate-900">Prof. (Dr.) Archana Prakash</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Controller of Examinations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
