"use client";

import React, { useState, useEffect } from "react";
import { COURSES } from "@/data/mockData";
import { fetchCourses, type CourseOutcomeSet } from "@/lib/obe";
import { useUniversity } from "@/context/UniversityContext";
import {
  CalendarCheck,
  Clock,
  BookOpen,
  Users,
  Stethoscope,
  Building2,
  Calendar,
  Phone,
  Search,
  MapPin
} from "lucide-react";

interface FacultyWorkspaceProps {
  activeSchoolId?: string;
  activeSection?: string;
}

export const FacultyWorkspace: React.FC<FacultyWorkspaceProps> = ({
  activeSchoolId = "ALL",
  activeSection = "attendance",
}) => {
  const { currentUser, students, attendanceMap, markAttendance, markAllAttendance } = useUniversity();

  const isHims =
    currentUser?.schoolCode === "HIMS" ||
    activeSchoolId === "sch_med";

  const [selectedCourse, setSelectedCourse] = useState(isHims ? "PATH201" : "CS401");
  const [activeTab, setActiveTab] = useState<"attendance" | "schedule" | "cia" | "students">("attendance");
  const [studentSearch, setStudentSearch] = useState("");
  const [realCourses, setRealCourses] = useState<CourseOutcomeSet[]>([]);

  useEffect(() => {
    setSelectedCourse(isHims ? "PATH201" : "CS401");
  }, [isHims]);

  // Load the real courses for this faculty's school so attendance marking targets a
  // genuine seeded courseId (mock codes like CS401 / PATH201 do not exist in the DB).
  useEffect(() => {
    let active = true;
    const programId = students.find((s) =>
      isHims ? s.schoolId === "sch_med" : s.schoolId === "sch_eng"
    )?.programId;
    if (!programId) return;
    fetchCourses(programId)
      .then((courses) => {
        if (active) setRealCourses(courses);
      })
      .catch(() => {
        // Leave realCourses empty; marking stays disabled until courses load.
      });
    return () => {
      active = false;
    };
  }, [isHims, students]);

  useEffect(() => {
    if (activeSection === "schedule") {
      setActiveTab("schedule");
    } else if (activeSection === "cia") {
      setActiveTab("cia");
    } else if (activeSection === "students") {
      setActiveTab("students");
    } else if (activeSection === "attendance") {
      setActiveTab("attendance");
    }
  }, [activeSection]);

  const [ciaMarks, setCiaMarks] = useState<Record<string, { q1: number; q2: number; mid: number }>>({});

  // STRICT SCHOOL-BASED STUDENT ISOLATION
  const scopedStudents = isHims
    ? students.filter((s) => s.schoolId === "sch_med")
    : students.filter((s) => s.schoolId === "sch_eng");

  const filteredRollStudents = scopedStudents.filter(
    (s) =>
      s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.enrollmentNo.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Prefer a real seeded course matching the selected code; fall back to the first
  // real course of the school so the attendance API always receives a valid courseId.
  const realCourse =
    (selectedCourse && realCourses.find((c) => c.courseCode === selectedCourse)) ||
    realCourses[0];

  const mockCourse =
    COURSES.find((c) => c.code === selectedCourse) ||
    (isHims ? COURSES.find((c) => c.code === "PATH201") : COURSES.find((c) => c.code === "CS401")) ||
    COURSES[0];

  const currentCourse = (realCourse ?? mockCourse) as {
    code?: string;
    title?: string;
    courseCode?: string;
    courseTitle?: string;
  };

  const handleToggleAttendance = (studentId: string, status: "P" | "A" | "OD") => {
    if (!realCourse?.id) return;
    void markAttendance(studentId, status, { courseId: realCourse.id });
  };

  const handleMarkAll = (status: "P" | "A") => {
    if (!realCourse?.id) return;
    void markAllAttendance(status, { courseId: realCourse.id });
  };

  // Authentic Timetables
  const weeklyTimetable = isHims
    ? [
      { day: "Monday", time: "10:00 - 11:30 AM", course: "PATH201: Histopathology Lab", hall: "Medical College Lab 2", type: "Clinical Practical" },
      { day: "Monday", time: "11:30 AM - 01:30 PM", course: "CLIN202: Ward Rotations", hall: "1,200-Bed Himalayan Hospital", type: "Ward Posting" },
      { day: "Tuesday", time: "09:00 - 10:30 AM", course: "PATH201: Systemic Pathology", hall: "Medical Auditorium 1", type: "Theory Lecture" },
      { day: "Tuesday", time: "11:30 AM - 01:30 PM", course: "CLIN202: Hospital Ward Rounds", hall: "Medicine & Surgery In-Patient Wards", type: "Ward Posting" },
      { day: "Wednesday", time: "10:00 - 11:30 AM", course: "PATH201: Clinical Pathology Demonstration", hall: "Pathology Museum Block", type: "Clinical Practical" },
      { day: "Thursday", time: "09:00 - 10:30 AM", course: "MICRO203: Clinical Microbiology", hall: "Teaching Hospital Block", type: "Integrated Lecture" },
      { day: "Friday", time: "10:00 - 11:30 AM", course: "Clinical CPC & Histology Review", hall: "Auditorium Hall 2", type: "CPC Conference" },
    ]
    : [
      { day: "Monday", time: "10:00 - 11:00 AM", course: "CS401: Design & Analysis of Algorithms", hall: "Room LH-204 (SST Block)", type: "Theory Lecture" },
      { day: "Monday", time: "02:00 - 04:00 PM", course: "CS402: Database Systems Lab", hall: "Computing Lab 3 (SST)", type: "Lab Practical" },
      { day: "Tuesday", time: "09:00 - 10:00 AM", course: "CS401: Algorithms Lecture", hall: "Room LH-204", type: "Theory Lecture" },
      { day: "Tuesday", time: "11:15 AM - 12:15 PM", course: "CS404: Operating Systems", hall: "Room LH-102", type: "Theory Lecture" },
      { day: "Wednesday", time: "10:00 - 11:00 AM", course: "CS401: Tutorial & Problem Solving", hall: "Room LH-204", type: "Tutorial" },
      { day: "Thursday", time: "11:15 AM - 12:15 PM", course: "CS404: Operating Systems", hall: "Room LH-102", type: "Theory Lecture" },
      { day: "Friday", time: "02:00 - 04:00 PM", course: "Coding Club & Hackathon Mentoring", hall: "Tinkering Lab", type: "Mentoring" },
    ];

  return (
    <div className="space-y-5">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {isHims ? "Dr. Sanjeev Kishore" : "Dr. Sandeep Kumar"}
            </h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${isHims
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-indigo-50 text-indigo-800 border-indigo-200"
                }`}
            >
              {isHims ? (
                <>
                  <Stethoscope className="h-3 w-3" />
                  <span>HIMS • Dept. of Pathology (MBBS Unit)</span>
                </>
              ) : (
                <>
                  <Building2 className="h-3 w-3" />
                  <span>SST • Dept. of Computer Science &amp; Engineering</span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isHims
              ? "Himalayan Institute of Medical Sciences • 1,200-Bed Himalayan Hospital Teaching Faculty • NMC Regulatory Compliance"
              : "School of Science & Technology • Swami Rama Himalayan University • AICTE & UGC Autonomous Faculty Console"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Today: </span>
            <span className="font-bold text-slate-800">
              {isHims ? "1 Clinical Lecture + 1 Ward Posting" : "2 Lectures + 1 Lab"}
            </span>
          </div>
          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Standard: </span>
            <span className="font-bold text-emerald-700">
              {isHims ? "NMC 80% / 85%" : "UGC 75% Rule"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Faculty Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">

        {/* Tab Headers */}
        <div className="border-b border-slate-200 px-6 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "attendance"
                ? isHims
                  ? "border-emerald-600 text-emerald-700"
                  : "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <span className="flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4" />
                {isHims ? "Ward & Lecture Roll-Call" : "Lecture Roll-Call"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("schedule")}
              className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "schedule"
                ? isHims
                  ? "border-emerald-600 text-emerald-700"
                  : "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Lecture &amp; Lab Schedule
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cia")}
              className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "cia"
                ? isHims
                  ? "border-emerald-600 text-emerald-700"
                  : "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {isHims ? "Clinical Logbook & Assessment" : "Continuous Internal Assessment (CIA 30)"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("students")}
              className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "students"
                ? isHims
                  ? "border-emerald-600 text-emerald-700"
                  : "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Student Roll Directory ({scopedStudents.length})
              </span>
            </button>
          </div>

          <span className="text-xs font-semibold text-slate-500 font-mono">
            Unit: {isHims ? "HIMS (Medical)" : "SST (Engineering)"}
          </span>
        </div>

        {/* TAB 1: ATTENDANCE ROLL-CALL */}
        {activeTab === "attendance" && (
          <div className="p-6 space-y-5">
            {/* Class Schedule Selection Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {isHims ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedCourse("PATH201")}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${selectedCourse === "PATH201"
                      ? "bg-emerald-50/70 border-emerald-500 shadow-xs ring-1 ring-emerald-400"
                      : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-emerald-700">PATH201 • Clinical Pathology</span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="h-3 w-3" /> 10:00 - 11:30 AM
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-1">General &amp; Systemic Pathology</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Medical Auditorium 1 • MBBS Prof Year 2</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCourse("CLIN202")}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${selectedCourse === "CLIN202"
                      ? "bg-emerald-50/70 border-emerald-500 shadow-xs ring-1 ring-emerald-400"
                      : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-emerald-700">CLIN202 • Ward Rotations</span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="h-3 w-3" /> 11:30 AM - 01:30 PM
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-1">Clinical Postings &amp; Ward Rounds</h4>
                    <p className="text-xs text-slate-500 mt-0.5">1,200-Bed Himalayan Hospital (Medicine Ward B)</p>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedCourse("CS401")}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${selectedCourse === "CS401"
                      ? "bg-indigo-50/70 border-indigo-500 shadow-xs ring-1 ring-indigo-400"
                      : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-indigo-600">CS401 • Lecture</span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="h-3 w-3" /> 10:00 - 11:00 AM
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-1">Design &amp; Analysis of Algorithms</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Room LH-204 • B.Tech CSE Sem 4 (Sec A)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCourse("CS402")}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${selectedCourse === "CS402"
                      ? "bg-indigo-50/70 border-indigo-500 shadow-xs ring-1 ring-indigo-400"
                      : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-indigo-600">CS402 • Lab Practical</span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="h-3 w-3" /> 02:00 - 04:00 PM
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-1">Database Systems Lab</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Lab 3 • B.Tech CSE Sem 4 (Sec B)</p>
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>Mark Attendance • {currentCourse.courseCode ?? currentCourse.code}: {currentCourse.courseTitle ?? currentCourse.title}</span>
                  {isHims && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      NMC Regulated
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHims
                    ? "National Medical Commission (NMC) mandatory threshold: 80% in Theory & 85% in Clinical Rotations."
                    : "UGC 75% baseline active. Toggle each student's attendance status."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMarkAll("P")}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200 cursor-pointer"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkAll("A")}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 cursor-pointer"
                >
                  Mark All Absent
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Term Attendance</th>
                    <th className="px-4 py-3">{isHims ? "NMC Status (80%/85%)" : "UGC Status (75%)"}</th>
                    <th className="px-4 py-3 text-right">Mark Today</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {scopedStudents.map((st) => {
                    const status = attendanceMap[st.id] || "P";
                    const isShortage = isHims
                      ? st.attendancePercentage < 80.0
                      : st.attendancePercentage < 75.0;

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">{st.rollNo}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div>{st.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {isHims ? "MBBS Professional Year 2 • Himalayan Hospital" : "B.Tech Computer Science • Sec A"}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <span className={isShortage ? "text-rose-600 font-bold" : "text-emerald-700"}>
                            {st.attendancePercentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isShortage ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              Shortage ({isHims ? "<80% NMC" : "<75% UGC"})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Eligible
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(st.id, "P")}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${status === "P"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                              P
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(st.id, "A")}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${status === "A"
                                ? "bg-rose-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                              A
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(st.id, "OD")}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${status === "OD"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                              OD
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
        )}

        {/* TAB 2: SCHEDULE */}
        {activeTab === "schedule" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {isHims ? "MBBS Clinical & Lecture Timetable" : "Weekly Teaching Schedule (Even Sem 2026)"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHims
                    ? "Rotations between Medical College Lecture Theatres and 1,200-Bed Himalayan Hospital Wards."
                    : "School of Science & Technology (SST) Departmental lecture halls and computer laboratories."}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                16 Teaching Hours / Week
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Time Slot</th>
                    <th className="px-4 py-3">Course Title</th>
                    <th className="px-4 py-3">Venue / Location</th>
                    <th className="px-4 py-3">Session Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {weeklyTimetable.map((slot, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">{slot.day}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{slot.time}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{slot.course}</td>
                      <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>{slot.hall}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {slot.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CIA ASSESSMENT */}
        {activeTab === "cia" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {isHims
                    ? "Clinical Internal Assessment & Logbook • Max 40 Marks"
                    : "Continuous Internal Assessment (CIA) • Max 30 Marks"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHims
                    ? "Clinical Ward Posting Log (15) + Histopathology Practical (15) + Viva Voce (10) = 40 Marks."
                    : "Quiz 1 (10) + Quiz 2 (10) + Mid-Semester Test (10) = CIA Total (30)."}
                </p>
              </div>

            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">{isHims ? "Ward Logbook (15)" : "Quiz 1 (10)"}</th>
                    <th className="px-4 py-3">{isHims ? "Histopath Lab (15)" : "Quiz 2 (10)"}</th>
                    <th className="px-4 py-3">{isHims ? "Clinical Viva (10)" : "Mid-Term (10)"}</th>
                    <th className="px-4 py-3 font-bold text-indigo-700 text-right">
                      {isHims ? "Total Clinical (40)" : "Total CIA (30)"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {scopedStudents.map((st) => {
                    const marks = ciaMarks[st.id] || { q1: 8, q2: 8, mid: 9 };
                    const total = marks.q1 + marks.q2 + marks.mid;
                    return (
                      <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">{st.rollNo}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{st.fullName}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max={isHims ? 15 : 10}
                            value={marks.q1}
                            onChange={(e) =>
                              setCiaMarks((prev) => ({
                                ...prev,
                                [st.id]: { ...marks, q1: Math.min(isHims ? 15 : 10, Math.max(0, Number(e.target.value))) },
                              }))
                            }
                            className="w-16 px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max={isHims ? 15 : 10}
                            value={marks.q2}
                            onChange={(e) =>
                              setCiaMarks((prev) => ({
                                ...prev,
                                [st.id]: { ...marks, q2: Math.min(isHims ? 15 : 10, Math.max(0, Number(e.target.value))) },
                              }))
                            }
                            className="w-16 px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={marks.mid}
                            onChange={(e) =>
                              setCiaMarks((prev) => ({
                                ...prev,
                                [st.id]: { ...marks, mid: Math.min(10, Math.max(0, Number(e.target.value))) },
                              }))
                            }
                            className="w-16 px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-black text-indigo-700 text-sm">
                          {total} / {isHims ? 40 : 30}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: STUDENT ROLL DIRECTORY */}
        {activeTab === "students" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {isHims ? "HIMS MBBS Professional Batch Directory" : "SST Engineering Student Directory"}
                </h3>
                <p className="text-xs text-slate-500">
                  Official registered student directory with parent contacts and live attendance status.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search student or roll no..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRollStudents.map((st) => (
                <div key={st.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {st.fullName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{st.fullName}</h4>
                      <p className="font-mono text-[10px] text-slate-500">{st.rollNo} • {st.enrollmentNo}</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Attendance:</span>
                      <strong className={st.attendancePercentage < (isHims ? 80 : 75) ? "text-rose-600" : "text-emerald-700"}>
                        {st.attendancePercentage}% ({st.attendancePercentage < (isHims ? 80 : 75) ? "Shortage" : "Eligible"})
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Quota:</span>
                      <span>{st.quota}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Parent:</span>
                      <span>{st.parentName}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <a href={`tel:${st.mobile}`} className="text-indigo-600 hover:underline flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Call Student
                    </a>
                    <a href={`tel:${st.parentMobile}`} className="text-slate-500 hover:underline flex items-center gap-1">
                      Parent: {st.parentMobile}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Advisory Notice */}
      <div
        className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${isHims
          ? "bg-emerald-50 border-emerald-200 text-emerald-950"
          : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
      >
        {isHims ? (
          <Stethoscope className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
        ) : (
          <Users className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div>
          <span className="font-bold">
            {isHims ? "NMC Statutory Advisory (MBBS):" : "UGC / AICTE Faculty Advisory:"}
          </span>{" "}
          {isHims
            ? "National Medical Commission guidelines dictate that MBBS candidates with <80% in Theory or <85% in Clinical Postings cannot be issued Professional Examination Hall Tickets without Dean (Medical) and COE statutory clearance."
            : "Students with overall attendance <75% will be debarred from End-Term examinations unless condoned on medical or authorized institutional representation grounds by the Director SST."}
        </div>
      </div>

    </div>
  );
};
