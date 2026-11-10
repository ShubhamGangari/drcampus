"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  CalendarCheck,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Download,
  BookOpen,
  Building,
  User,
  ArrowRight,
  Printer,
  Check,
  Award,
  QrCode,
  Bus,
  XCircle
} from "lucide-react";
import { COURSES } from "@/data/mockData";
import { Course } from "@/types";
import { useUniversity } from "@/context/UniversityContext";
import { fetchExams, fetchSchedules, formatDate, formatTime } from "@/lib/exams";

interface StudentWorkspaceProps {
  activeSchoolId?: string;
  activeSection?: string;
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({
  activeSchoolId = "ALL",
  activeSection = "overview",
}) => {
  const { currentUser, students, settleFee, appeals, actionAppeal } = useUniversity();

  const isHimsStudent =
    currentUser?.schoolCode === "HIMS" ||
    activeSchoolId === "sch_med" ||
    currentUser?.email?.includes("rohan") ||
    currentUser?.email?.includes("mbbs");

  // Dynamic student binding:
  const student = isHimsStudent
    ? students.find((s) => s.id === "stu_3") || students.find((s) => s.schoolId === "sch_med") || students[0]
    : students.find((s) => s.id === "stu_1") || students.find((s) => s.schoolId === "sch_eng") || students[0];

  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "fees" | "results" | "admit-card">("overview");

  React.useEffect(() => {
    if (activeSection && ["overview", "attendance", "fees", "results", "admit-card"].includes(activeSection)) {
      setActiveTab(activeSection as "overview" | "attendance" | "fees" | "results" | "admit-card");
    }
  }, [activeSection]);
  const [showFeePaymentModal, setShowFeePaymentModal] = useState<boolean>(false);
  const [paymentStep, setPaymentStep] = useState<"SELECT" | "PAYING" | "SUCCESS">("SELECT");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "NETBANKING" | "CARD">("UPI");
  const [paidReceipt, setPaidReceipt] = useState<{ txnId: string; date: string; amount: number } | null>(null);
  const [condonationToast, setCondonationToast] = useState<string | null>(null);

  const condonationAppeal = appeals.find((a) => a.studentId === student.id);
  const thresholdPct = isHimsStudent ? 80.0 : 75.0;
  const isCondoned = condonationAppeal?.status === "APPROVED";

  const effectiveDues = student.feeDues;
  const effectiveAttendance = student.attendancePercentage;
  const isAttendanceEligible = effectiveAttendance >= thresholdPct || isCondoned;
  const isFeeEligible = effectiveDues === 0;
  const isAdmitCardIssued = isAttendanceEligible && isFeeEligible;
  const feePaidInSession = effectiveDues === 0;
  const condonationApproved = isCondoned;

  const studentCourses = COURSES.filter((c: Course) =>
    isHimsStudent ? c.programId === "prog_mbbs" : c.programId === "prog_btech_cse"
  );

  // Subject-wise attendance calculation
  const attendanceBreakdown = isHimsStudent
    ? [
      { code: "PATH201", title: "General & Systemic Pathology", held: 48, attended: 45, pct: 93.8, faculty: "Dr. Sanjeev Kishore" },
      { code: "CLIN202", title: "Clinical Postings (1200-Bed Himalayan Hospital)", held: 60, attended: 56, pct: 93.3, faculty: "Prof. & Head Clinical Medicine" },
      { code: "PHARM203", title: "Pharmacology & Therapeutics", held: 44, attended: 40, pct: 90.9, faculty: "Dr. D. C. Dhasmana" },
      { code: "MICRO204", title: "Microbiology & Parasitology", held: 40, attended: 36, pct: 90.0, faculty: "Dr. Barnali Kakati" },
    ]
    : [
      { code: "CS401", title: "Design & Analysis of Algorithms", held: 42, attended: 28, pct: 66.7, faculty: "Dr. Sandeep Kumar" },
      { code: "CS402", title: "Database Management Systems", held: 38, attended: 30, pct: 78.9, faculty: "Prof. Priya Verma" },
      { code: "CS403", title: "Computer Networks & Security", held: 40, attended: 27, pct: 67.5, faculty: "Dr. Vikram Singh" },
      { code: "CS404", title: "Operating Systems", held: 36, attended: 29, pct: 80.6, faculty: "Prof. Neha Gupta" },
    ];

  // Grade history
  const semesterResults = isHimsStudent
    ? [
      { sem: "MBBS 1st Professional Year", sgpa: 8.91, credits: 36, status: "PASSED (First Class with Distinction)" },
      { sem: "MBBS 2nd Professional Year (Current)", sgpa: 8.75, credits: 32, status: "Clinical Postings Ongoing" },
    ]
    : [
      { sem: "Semester 1", sgpa: 8.42, credits: 21, status: "PASSED (First Class with Distinction)" },
      { sem: "Semester 2", sgpa: 8.18, credits: 22, status: "PASSED (First Class with Distinction)" },
      { sem: "Semester 3", sgpa: 8.65, credits: 23, status: "PASSED (First Class with Distinction)" },
      { sem: "Semester 4 (Current)", sgpa: 8.35, credits: 22, status: "Provisional / CIA Ongoing" },
    ];

  // Live exam timetable for the Admit Card — sourced from published exams only
  // (the exams API scopes students to PUBLISHED exams and their schedules).
  const [examTimetable, setExamTimetable] = useState<
    { id: string; code: string; title: string; date: string; time: string; hall: string }[]
  >([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  React.useEffect(() => {
    let alive = true;
    setLoadingTimetable(true);
    (async () => {
      try {
        const exams = await fetchExams();
        if (!alive || exams.length === 0) return;
        const current = exams[0];
        const sched = await fetchSchedules(current.id);
        if (!alive) return;
        setExamTimetable(
          sched.map((s) => ({
            id: s.id,
            code: s.courseCode,
            title: s.courseTitle,
            date: formatDate(s.examDate),
            time: formatTime(s.startTime),
            hall: s.venue,
          }))
        );
      } catch {
        if (alive) setExamTimetable([]);
      } finally {
        if (alive) setLoadingTimetable(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [student?.programId]);

  const handleInitiatePayment = () => {
    setPaymentStep("PAYING");
    setTimeout(async () => {
      const mode = paymentMethod === "NETBANKING" ? "Net Banking" : paymentMethod === "CARD" ? "Credit Card" : "UPI";
      const receipt = await settleFee(student.id, student.feeDues, mode);
      if (receipt) {
        setPaidReceipt({
          txnId: receipt.transactionId,
          date: receipt.transactionDate,
          amount: receipt.totalAmount,
        });
      }
      setPaymentStep("SUCCESS");
    }, 1200);
  };

  const handleSimulateCondonation = () => {
    if (condonationAppeal) {
      actionAppeal(condonationAppeal.id, "APPROVED");
    } else {
      const app = appeals.find((a) => a.studentId === student.id) ||
        (isHimsStudent ? appeals.find((a) => a.schoolId === "sch_med") : appeals.find((a) => a.schoolId === "sch_eng"));
      if (app) {
        actionAppeal(app.id, "APPROVED");
      }
    }
    setCondonationToast(
      isHimsStudent
        ? "Medical Condonation granted by Dean HIMS (Prof. Ahamadulla Shariff) on Himalayan Hospital certificate. Attendance restored to 83.5% (NMC Compliant)."
        : "Medical Condonation granted by Director SST (Prof. Pramod Kumar) on Himalayan Hospital slip. Attendance restored to 76.5%."
    );
    setTimeout(() => setCondonationToast(null), 5000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Toast Notification */}
      {condonationToast && (
        <div className="bg-emerald-600 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{condonationToast}</span>
          </div>
          <button onClick={() => setCondonationToast(null)} className="ml-3 text-white/80 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Student Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 overflow-hidden relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0">
              {student.fullName.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {student.fullName}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {student.enrollmentNo}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  Roll: {student.rollNo}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-y-1 gap-x-3">
                <span className="font-medium text-slate-800">
                  {isHimsStudent ? "Bachelor of Medicine & Bachelor of Surgery (MBBS)" : "B.Tech Computer Science & Engineering"}
                </span>
                <span>•</span>
                <span>{isHimsStudent ? "MBBS Professional Year 2" : "Semester 4"}</span>
                <span>•</span>
                <span>{isHimsStudent ? "Himalayan Institute of Medical Sciences (HIMS)" : "School of Science & Technology (SST)"}</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Overall CGPA</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{student.academicPerformance.cgpa.toFixed(2)}</p>
              <span className="text-[10px] text-emerald-600 font-semibold">{isHimsStudent ? "MBBS Grading" : "10-Point Scale"}</span>
            </div>
            <div className="h-10 w-px bg-slate-200 hidden sm:block" />
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Attendance</p>
              <p className={`text-xl font-bold mt-0.5 ${!isAttendanceEligible ? "text-rose-600" : "text-emerald-600"}`}>
                {effectiveAttendance.toFixed(1)}%
              </p>
              <span className={`text-[10px] font-semibold ${!isAttendanceEligible ? "text-rose-600" : "text-emerald-600"}`}>
                {!isAttendanceEligible
                  ? isHimsStudent
                    ? "Below 80% NMC"
                    : "Below 75% UGC"
                  : condonationApproved
                    ? isHimsStudent
                      ? "Condoned (80%)"
                      : "Condoned (75%)"
                    : "Eligible"}
              </span>
            </div>
            <div className="h-10 w-px bg-slate-200 hidden sm:block" />
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pending Dues</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">
                {effectiveDues > 0 ? `₹${effectiveDues.toLocaleString("en-IN")}` : "Nil"}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                {effectiveDues > 0 ? (isHimsStudent ? "MBBS Tuition" : "Sem 4 Tuition") : "Accounts Clear"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100 overflow-x-auto">
          {[
            { id: "overview", label: "Dashboard Overview", icon: BookOpen },
            { id: "attendance", label: "Attendance & 75% Tracker", icon: CalendarCheck, badge: !isAttendanceEligible ? "Shortage" : null },
            { id: "fees", label: "Fee Ledger & Online Pay", icon: CreditCard, badge: effectiveDues > 0 ? `₹${effectiveDues.toLocaleString("en-IN")}` : null },
            { id: "results", label: "Grade Cards & CGPA", icon: GraduationCap },
            { id: "admit-card", label: "Exam Hall Ticket", icon: Award, badge: isAdmitCardIssued ? "Available" : "On Hold" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "overview" | "attendance" | "fees" | "results" | "admit-card")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0 cursor-pointer ${isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tab.badge === "Available"
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-rose-500 text-white"
                      : "bg-rose-100 text-rose-700"
                    }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Warning / Status */}
          <div className="lg:col-span-2 space-y-6">
            {!isAttendanceEligible ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-rose-100 rounded-xl text-rose-600 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-rose-950 text-sm">
                      Attendance Shortage Advisory ({isHimsStudent ? "NMC 80% Mandatory Norm" : "Clause 4.2 UGC Mandate"})
                    </h3>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      Your cumulative attendance stands at <strong className="font-semibold">{effectiveAttendance}%</strong>, which is below the mandatory {thresholdPct}% threshold. You require an authorized Medical Condonation Certificate approved by {isHimsStudent ? "Dean HIMS (Prof. Ahamadulla Shariff)" : "Director SST (Prof. Pramod Kumar)"} with Himalayan Hospital discharge certificate.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("attendance")}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors cursor-pointer"
                >
                  View Attendance Breakdown
                </button>
              </div>
            ) : condonationAppeal?.status === "APPROVED" ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-950 text-sm">
                      Medical Condonation Sanctioned by {isHimsStudent ? "Dean HIMS" : "Director SST"}
                    </h3>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      Your leave on Himalayan Hospital medical certificate has been granted. Your effective attendance is restored to <strong className="font-semibold">{effectiveAttendance}%</strong>. Examination admit card clearance is approved.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("admit-card")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors cursor-pointer"
                >
                  View Admit Card
                </button>
              </div>
            ) : null}

            {/* Current Registered Courses */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {isHimsStudent ? "MBBS Professional Year 2 Courses & Hospital Postings" : "Current Enrolled Courses (Sem 4)"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isHimsStudent
                      ? "National Medical Commission (NMC) CBME Curriculum • Clinical Rotations at Himalayan Hospital"
                      : "Choice Based Credit System (CBCS) • 22 Total Credits"}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                  Even Semester 2026
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {studentCourses.map((c: Course) => (
                  <div key={c.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {c.code}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{c.title}</h4>
                        <p className="text-xs text-slate-500">
                          {c.credits} Credits ({c.theoryHours}L + {c.practicalHours}P) • Evaluation: {c.maxInternalMarks} CIA + {c.maxExternalMarks} ESE
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                      Regular Enrolled
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Widgets: Campus Info, Bus & Fee Quick Action */}
          <div className="space-y-6">
            {/* Fee Dues Action Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fee Account</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${effectiveDues > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                  {effectiveDues > 0 ? "Due Pending" : "All Clear"}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-black text-slate-900">₹{effectiveDues.toLocaleString("en-IN")}</p>
                <p className="text-xs text-slate-500 mt-0.5">Sem 4 Tuition &amp; Laboratory Assessment Fee</p>
              </div>

              {effectiveDues > 0 ? (
                <button
                  onClick={() => {
                    setActiveTab("fees");
                    setShowFeePaymentModal(true);
                  }}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Pay Now via UPI / NetBanking</span>
                </button>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Accounts cleared. Finance clearance granted.</span>
                </div>
              )}
            </div>

            {/* University Bus Transport Route */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Bus className="h-4 w-4 text-indigo-600" />
                <span>Campus Shuttle &amp; Transport</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Route Allotted</span>
                  <span className="font-semibold text-slate-800">Route 1 (ISBT - Clock Tower)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Bus Vehicle No</span>
                  <span className="font-mono font-bold text-slate-900">UK-07-PA-4421</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Boarding Point</span>
                  <span className="font-medium text-slate-700">Dilaram Chowk (07:35 AM)</span>
                </div>
              </div>
            </div>

            {/* Hostel & Campus Residence */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Building className="h-4 w-4 text-indigo-600" />
                <span>Hostel &amp; Campus Residence</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Hostel Block</span>
                  <span className="font-semibold text-slate-800">
                    {isHimsStudent ? "Charak Medical Hostel" : "Raman Bhavan (Boys Hostel B)"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Room Number</span>
                  <span className="font-semibold text-slate-800">
                    {isHimsStudent ? "M-112 (AC Double)" : "B-304 (Double Occupancy)"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Mess Facility</span>
                  <span className="font-semibold text-emerald-700">
                    {isHimsStudent ? "HIMS Resident Doctors & Students Mess" : "Central Mess A (Active)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Advisor */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-600" />
                <span>Academic Advisor / Proctor</span>
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm">
                  SK
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-xs">
                    {isHimsStudent ? "Dr. Sanjeev Kishore" : "Dr. Sandeep Kumar"}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isHimsStudent ? "Professor & Head, Pathology (HIMS)" : "Associate Professor, Dept. of CSE (SST)"}
                  </p>
                  <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                    {isHimsStudent ? "sanjeev.path@srhu.edu.in" : "sandeep.cse@srhu.edu.in"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE & 75% TRACKER */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {isHimsStudent ? "MBBS Ward Postings & Theory Attendance Register" : "Course-Wise Attendance Register"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHimsStudent
                    ? "Statutory NMC requirement: 80% Theory & 85% Hospital Ward Rotations at 1,200-Bed Himalayan Hospital"
                    : "Statutory UGC 75% minimum requirement as per SRHU Academic Ordinance 2024"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${isAttendanceEligible ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}>
                  Current Cumulative: {effectiveAttendance.toFixed(1)}% {condonationApproved && "(Medical Condoned)"}
                </span>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Course Code &amp; Title</th>
                    <th className="py-3 px-4">Course Instructor</th>
                    <th className="py-3 px-4 text-center">Classes Held</th>
                    <th className="py-3 px-4 text-center">Attended</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4 text-center">UGC 75% Status</th>
                    <th className="py-3 px-4 text-right">Required to 75%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceBreakdown.map((item) => {
                    const isShort = item.pct < 75.0 && !condonationApproved;
                    const classesNeeded = Math.max(0, Math.ceil(3 * item.held - 4 * item.attended));
                    return (
                      <tr key={item.code} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900">{item.code}</span>
                          <p className="text-slate-500 text-[11px]">{item.title}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{item.faculty}</td>
                        <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-800">{item.held}</td>
                        <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-900">{item.attended}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`font-mono font-bold ${isShort ? "text-rose-600" : "text-emerald-600"}`}>
                            {condonationApproved ? "75.2%" : `${item.pct.toFixed(1)}%`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isShort ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                              Shortage (&lt;75%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                              Eligible (≥75%)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isShort ? (
                            <span className="font-semibold text-rose-600">Attend next {classesNeeded} lectures</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Safe Margin</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Condonation Appeal Box */}
            <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-slate-800">
                  {condonationApproved ? "Medical Condonation Active" : "Need Medical Attendance Condonation?"}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {condonationApproved
                    ? "Condonation granted by Director SST (Prof. Pramod Kumar) based on Himalayan Hospital (HIMS) slip."
                    : "Absences due to hospitalization at Himalayan Hospital (HIMS) can be condoned up to 5% by Director SST."}
                </p>
              </div>
              {!condonationApproved ? (
                <button
                  onClick={handleSimulateCondonation}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  Verify HIMS Medical Slip &amp; Apply
                </button>
              ) : (
                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Condoned &amp; Approved
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FEES & ONLINE PAYMENT */}
      {activeTab === "fees" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <span className="text-xs text-slate-500 font-medium">Total Program Fee</span>
              <p className="text-2xl font-black text-slate-900 mt-1">₹{student.totalFeePayable.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {isHimsStudent ? "MBBS Annual Tuition & Clinical Fee" : "Academic Session 2025-26 (Sem 4)"}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <span className="text-xs text-slate-500 font-medium">Amount Realized</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                ₹{student.totalFeePaid.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                {student.feeDues === 0 ? "100% Realized (All Clear)" : `Installment Paid (Receipt Available)`}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <span className="text-xs text-slate-500 font-medium">Balance Pending</span>
              <p className={`text-2xl font-black mt-1 ${effectiveDues > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                ₹{effectiveDues.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {effectiveDues > 0 ? "Due Date: 15-Mar-2026" : "Zero Balance (Cleared)"}
              </p>
            </div>
          </div>

          {/* Fee Heads Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Semester Fee Heads Breakdown</h3>
                <p className="text-xs text-slate-500">Official fee schedule approved by SRHU Board of Management</p>
              </div>
              {effectiveDues > 0 && (
                <button
                  onClick={() => setShowFeePaymentModal(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Pay Outstanding Dues</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {[
                { head: "Tuition Fee (Sem 4)", billed: 85000, paid: feePaidInSession ? 85000 : 55000, balance: feePaidInSession ? 0 : 30000, status: feePaidInSession ? "Paid" : "Partial" },
                { head: "Laboratory & Computing Facility Fee", billed: 15000, paid: feePaidInSession ? 15000 : 0, balance: feePaidInSession ? 0 : 15000, status: feePaidInSession ? "Paid" : "Unpaid" },
                { head: "Examination & Degree Audit Fee", billed: 5000, paid: 5000, balance: 0, status: "Paid" },
                { head: "Library & Digital IEEE Resources", billed: 10000, paid: 10000, balance: 0, status: "Paid" },
              ].map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.head}</p>
                    <p className="text-slate-500 text-[11px]">Billed: ₹{item.billed.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-800">
                      {item.balance > 0 ? `₹${item.balance.toLocaleString("en-IN")} Due` : "Cleared"}
                    </p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GRADE CARDS & CGPA */}
      {activeTab === "results" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Academic Performance &amp; UGC 10-Point SGPA Record</h3>
                <p className="text-xs text-slate-500">Autonomous Examination Division • Controller of Examinations (COE: Prof. Archana Prakash)</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Transcript</span>
                </button>
              </div>
            </div>

            {/* Semester History Table */}
            <div className="divide-y divide-slate-100 mt-4 text-xs">
              {semesterResults.map((sem, i) => (
                <div key={i} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0">
                      S{i + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{sem.sem}</h4>
                      <p className="text-slate-500 text-xs">
                        Earned Credits: {sem.credits} • Result: <span className="font-semibold text-emerald-700">{sem.status}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">Semester SGPA</p>
                      <p className="text-lg font-mono font-bold text-slate-900">{sem.sgpa.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => alert(`Official Grade Card for ${sem.sem} downloaded. Digital signature verified by COE Prof. Archana Prakash.`)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-500" />
                      <span>Grade Card</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: OFFICIAL EXAM ADMIT CARD / HALL TICKET */}
      {activeTab === "admit-card" && (
        <div className="space-y-6">
          {!isAdmitCardIssued ? (
            /* Debarment / On-Hold Dashboard */
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-rose-50 border border-rose-200">
                <div className="p-3 bg-rose-100 rounded-xl text-rose-600 shrink-0">
                  <XCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-950 text-base">
                    Hall Ticket On Hold: Clearance Conditions Pending
                  </h3>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    As per Ordinance 7.3 of Swami Rama Himalayan University, candidates must secure dual clearance (75% Attendance + Zero Accounts Outstanding) before the Controller of Examinations issues the official Hall Ticket.
                  </p>
                </div>
              </div>

              {/* Clearance Checkpoints */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. Accounts Clearance */}
                <div className={`p-4 rounded-xl border ${isFeeEligible ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">1. Finance / Accounts Clearance</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${isFeeEligible ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {isFeeEligible ? "CLEARED" : "HOLD"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-2">
                    {isFeeEligible ? "All semester fees paid in full." : `Outstanding dues: ₹${effectiveDues.toLocaleString("en-IN")}`}
                  </p>
                  {!isFeeEligible && (
                    <button
                      onClick={() => setShowFeePaymentModal(true)}
                      className="mt-3 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Clear Dues Now
                    </button>
                  )}
                </div>

                {/* 2. Attendance Clearance */}
                <div className={`p-4 rounded-xl border ${isAttendanceEligible ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      2. Attendance {isHimsStudent ? "NMC 80%" : "UGC 75%"} Clearance
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${isAttendanceEligible ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {isAttendanceEligible ? "CLEARED" : "SHORTAGE"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-2">
                    {isAttendanceEligible
                      ? `Attendance criteria satisfied (${thresholdPct}%+ or statutory condonation granted).`
                      : `Current attendance: ${effectiveAttendance.toFixed(1)}% (Short by ${Math.max(0, thresholdPct - effectiveAttendance).toFixed(1)}%).`}
                  </p>
                  {!isAttendanceEligible && (
                    <button
                      onClick={handleSimulateCondonation}
                      className="mt-3 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      {isHimsStudent ? "Apply for Dean HIMS Medical Condonation" : "Apply for Director SST Condonation"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Official SRHU Hall Ticket Document */
            <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-lg p-6 sm:p-8 space-y-6 print:border-none print:shadow-none">

              {/* Hall Ticket Header */}
              <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-slate-900 text-white font-black text-xl flex items-center justify-center shrink-0">
                    SRHU
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      SWAMI RAMA HIMALAYAN UNIVERSITY
                    </h2>
                    <p className="text-xs text-slate-600 font-medium">
                      Swami Ram Nagar, Jolly Grant, Dehradun - 248016 | NAAC Grade A+ (3.42)
                    </p>
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mt-0.5">
                      EXAMINATION ADMIT CARD / HALL TICKET • EVEN SEMESTER 2026
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Hall Ticket</span>
                  </button>
                </div>
              </div>

              {/* Candidate Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Candidate Name</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{student.fullName}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Enrollment Number</span>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{student.enrollmentNo}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px]">University Roll No</span>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{student.rollNo}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Program &amp; Semester</span>
                  <p className="font-semibold text-slate-900 text-sm mt-0.5">
                    {isHimsStudent ? "MBBS (Prof Year 2)" : "B.Tech CSE (Sem 4)"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Constituent School</span>
                  <p className="font-medium text-slate-800 mt-0.5">
                    {isHimsStudent ? "Himalayan Institute of Medical Sciences (HIMS)" : "School of Science & Technology (SST)"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Allotted Examination Center</span>
                  <p className="font-bold text-indigo-900 mt-0.5">
                    {isHimsStudent
                      ? "Himalayan Hospital Clinical Complex & Medical Examination Hall 1"
                      : "Academic Block III - Auditorium Hall A (Desk A-42)"}
                  </p>
                </div>
              </div>

              {/* Registered Courses & Exam Schedule */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2.5">Schedule of Registered Examination Papers</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Course Code</th>
                        <th className="py-2.5 px-3">Course Title</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Hall / Desk</th>
                        <th className="py-2.5 px-3 text-center">Invigilator Sign</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingTimetable ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">Loading exam schedule…</td>
                        </tr>
                      ) : examTimetable.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">No published examination schedule available yet.</td>
                        </tr>
                      ) : (
                        examTimetable.map((ex) => (
                          <tr key={ex.id}>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">{ex.code}</td>
                            <td className="py-3 px-3 font-semibold text-slate-800">{ex.title}</td>
                            <td className="py-3 px-3 font-medium text-slate-700">{ex.date}</td>
                            <td className="py-3 px-3 font-mono text-slate-600">{ex.time}</td>
                            <td className="py-3 px-3 text-slate-700">{ex.hall}</td>
                            <td className="py-3 px-3 text-center border-l border-slate-100 font-mono text-slate-300">
                              [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Instructions & Signatures */}
              <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 items-end gap-6 text-xs">
                <div>
                  <h5 className="font-bold text-slate-800 mb-1">Important Instructions for Candidate:</h5>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                    <li>Candidate must report to the examination hall 30 minutes before the scheduled time.</li>
                    <li>Possession of mobile phones, smartwatches, or programmable calculators is strictly prohibited.</li>
                    <li>Admit card must be preserved until the final declaration of results.</li>
                  </ul>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-6">
                  <div className="text-center">
                    <QrCode className="h-12 w-12 text-slate-900 mx-auto" />
                    <span className="font-mono text-[9px] text-slate-500 block mt-1">VERIFIED: SRHU-COE-2026</span>
                  </div>
                  <div className="text-right">
                    <p className="font-serif italic font-semibold text-sm text-slate-900">Prof. (Dr.) Archana Prakash</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Controller of Examinations</p>
                    <span className="text-[10px] text-emerald-700 font-medium">SRHU Dehradun</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* Online Fee Payment Modal */}
      {showFeePaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">SRHU Digital Payment Gateway</h3>
                <p className="text-xs text-slate-400">SBI ePay &amp; UPI Direct Settlement</p>
              </div>
              <button
                onClick={() => {
                  setShowFeePaymentModal(false);
                  setPaymentStep("SELECT");
                }}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {paymentStep === "SELECT" && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Student:</span>
                      <strong className="text-slate-900">{student.fullName} ({student.enrollmentNo})</strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>Payable Amount:</span>
                      <strong className="text-slate-900 font-mono text-sm">₹{effectiveDues.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-2">Select Payment Method</label>
                    <div className="space-y-2 text-xs">
                      {[
                        { id: "UPI", title: "UPI (Google Pay, PhonePe, Paytm, BHIM)", fee: "Zero Convenience Fee" },
                        { id: "NETBANKING", title: "Net Banking (SBI, HDFC, ICICI, PNB)", fee: "Instant Credit" },
                        { id: "CARD", title: "Debit / Credit Card (RuPay, Visa, MasterCard)", fee: "Standard Gateway" },
                      ].map((m) => (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${paymentMethod === m.id
                            ? "border-indigo-600 bg-indigo-50/50"
                            : "border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="payMethod"
                              checked={paymentMethod === m.id}
                              onChange={() => setPaymentMethod(m.id as "UPI" | "NETBANKING" | "CARD")}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <p className="font-semibold text-slate-900">{m.title}</p>
                              <p className="text-[10px] text-slate-500">{m.fee}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleInitiatePayment}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-4"
                  >
                    <span>Proceed to Pay ₹{effectiveDues.toLocaleString("en-IN")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {paymentStep === "PAYING" && (
                <div className="py-10 text-center space-y-4">
                  <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-slate-800">Processing Secure Transaction...</p>
                  <p className="text-xs text-slate-500">Connecting to National Payments Corporation of India (NPCI) gateway</p>
                </div>
              )}

              {paymentStep === "SUCCESS" && paidReceipt && (
                <div className="space-y-4 animate-in zoom-in-95">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <Check className="h-6 w-6 stroke-3" />
                  </div>
                  <div className="text-center">
                    <h4 className="font-bold text-slate-900 text-base">Payment Completed Successfully!</h4>
                    <p className="text-xs text-emerald-700 font-medium mt-0.5">Account ledger updated in University Finance Desk</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transaction Ref:</span>
                      <span className="font-bold text-slate-800">{paidReceipt.txnId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date &amp; Time:</span>
                      <span className="text-slate-800">{paidReceipt.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount Paid:</span>
                      <span className="font-bold text-emerald-600">₹{paidReceipt.amount.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowFeePaymentModal(false);
                      setPaymentStep("SELECT");
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Close &amp; Return to Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
