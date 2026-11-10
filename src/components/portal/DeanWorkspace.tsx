"use client";

import React, { useState, useEffect } from "react";
import { COURSES } from "@/data/mockData";
import { useUniversity } from "@/context/UniversityContext";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Stethoscope,
  Building2,
  Users,
  BookOpen,
  Award,
  ShieldCheck
} from "lucide-react";

interface DeanWorkspaceProps {
  activeSchoolId?: string;
  activeSection?: string;
}

export const DeanWorkspace: React.FC<DeanWorkspaceProps> = ({
  activeSchoolId = "ALL",
  activeSection = "overview",
}) => {
  const { currentUser, appeals, actionAppeal } = useUniversity();

  const isHimsDean =
    currentUser?.schoolCode === "HIMS" ||
    activeSchoolId === "sch_med" ||
    currentUser?.email?.includes("hims");

  // Strict School-Scoped Condonation Appeals Filter under SRHU Statute 8.2
  const relevantAppeals = appeals.filter((a) =>
    isHimsDean ? a.schoolId === "sch_med" : a.schoolId === "sch_eng"
  );
  const pendingAppealsCount = relevantAppeals.filter((a) => a.status === "PENDING").length;

  const [activeTab, setActiveTab] = useState<"overview" | "appeals" | "cbcs" | "workload">("overview");

  useEffect(() => {
    if (activeSection === "appeals") {
      setActiveTab("appeals");
    } else if (activeSection === "cbcs") {
      setActiveTab("cbcs");
    } else if (activeSection === "workload") {
      setActiveTab("workload");
    } else if (activeSection === "overview") {
      setActiveTab("overview");
    }
  }, [activeSection]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleActionAppeal = (id: string, action: "APPROVED" | "REJECTED") => {
    actionAppeal(id, action);
    setToastMessage(
      action === "APPROVED"
        ? `Attendance condonation approved on verified ${
            isHimsDean ? "Himalayan Hospital Medical Superintendent" : "SST Academic Committee"
          } grounds. Student eligible for End-Term exams.`
        : "Condonation appeal rejected. Exam debarment confirmed per statutory regulations."
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Scope courses to the school
  const schoolCourses = COURSES.filter((c) =>
    isHimsDean ? c.programId === "prog_mbbs" : c.programId === "prog_btech_cse"
  );

  // Faculty workload roster
  const facultyRoster = isHimsDean
    ? [
        { name: "Dr. Sanjeev Kishore", designation: "Professor & Head", dept: "Pathology", hours: 18, hospitalWards: "Clinical Histopathology Lab", status: "Optimal" },
        { name: "Dr. Sunil Saini", designation: "Professor & Surgeon", dept: "Surgical Oncology", hours: 22, hospitalWards: "1,200-Bed Cancer Block", status: "High Clinical Load" },
        { name: "Dr. D. C. Dhasmana", designation: "Professor & Head", dept: "Pharmacology", hours: 16, hospitalWards: "Clinical Pharmacology Lab", status: "Optimal" },
        { name: "Dr. Barnali Kakati", designation: "Professor & Head", dept: "Microbiology", hours: 16, hospitalWards: "Infectious Diseases Virology Lab", status: "Optimal" },
      ]
    : [
        { name: "Dr. Sandeep Kumar", designation: "Associate Professor", dept: "CSE", hours: 16, hospitalWards: "Advanced Computing Lab", status: "Optimal" },
        { name: "Prof. Priya Verma", designation: "Assistant Professor", dept: "CSE", hours: 18, hospitalWards: "Database & Cloud Computing Lab", status: "Optimal" },
        { name: "Dr. Vikram Singh", designation: "Associate Professor", dept: "CSE (Networks)", hours: 16, hospitalWards: "Cyber Security Lab", status: "Optimal" },
        { name: "Prof. Neha Gupta", designation: "Assistant Professor", dept: "AI & ML", hours: 18, hospitalWards: "GPU High Performance Cluster", status: "Optimal" },
      ];

  return (
    <div className="space-y-5">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="ml-3 text-white/80 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Clean Modern Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {isHimsDean ? "Prof. (Dr.) Ahamadulla Shariff" : "Prof. (Dr.) Pramod Kumar"}
            </h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                isHimsDean
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-indigo-50 text-indigo-800 border-indigo-200"
              }`}
            >
              {isHimsDean ? (
                <>
                  <Stethoscope className="h-3 w-3" />
                  <span>Dean, Medical Sciences (HIMS)</span>
                </>
              ) : (
                <>
                  <Building2 className="h-3 w-3" />
                  <span>Director &amp; Dean (SST)</span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isHimsDean
              ? "Himalayan Institute of Medical Sciences • 1,200-Bed Teaching Hospital Clinical Governance • NMC Regulatory Authority"
              : "School of Science & Technology • Swami Rama Himalayan University • AICTE / UGC Statutory Academic Council"}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Constituent Unit</span>
            <span className="font-bold text-slate-800">{isHimsDean ? "HIMS (Medical)" : "SST (Technology)"}</span>
          </div>
          <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Accreditation Mandate</span>
            <span className="font-bold text-emerald-700">{isHimsDean ? "NMC & NABH A+" : "NAAC A+ & NBA"}</span>
          </div>
        </div>
      </div>

      {/* Main Dean Workspace Card with Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 px-6 pt-4 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "overview"
                ? isHimsDean ? "border-emerald-600 text-emerald-700" : "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {isHimsDean ? "Dean Medical Secretariat" : "Director's Secretariat"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("appeals")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "appeals"
                ? isHimsDean ? "border-emerald-600 text-emerald-700" : "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              Medical Condonation Board ({pendingAppealsCount})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cbcs")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "cbcs"
                ? isHimsDean ? "border-emerald-600 text-emerald-700" : "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {isHimsDean ? "NMC CBME Rotations" : "NEP-2020 CBCS Allotment"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workload")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "workload"
                ? isHimsDean ? "border-emerald-600 text-emerald-700" : "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Faculty Workload Ratios
            </span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="p-6 space-y-5">
            {/* School Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">Average Unit Attendance</p>
                <h4 className="text-xl font-bold text-emerald-600 mt-1">
                  {isHimsDean ? "91.2%" : "84.1%"}
                </h4>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  {isHimsDean ? "Meets NMC 80%/85% threshold" : "Above UGC 75% baseline"}
                </span>
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">Pending Condonation Slips</p>
                <h4 className="text-xl font-bold text-amber-600 mt-1">
                  {pendingAppealsCount} Cases
                </h4>
                <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
                  {isHimsDean ? "Hospital Slips Verified" : "Dean SST Review Queue"}
                </span>
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">
                  {isHimsDean ? "Hospital Bed Occupancy" : "Curriculum CBCS Electives"}
                </p>
                <h4 className="text-xl font-bold text-slate-900 mt-1">
                  {isHimsDean ? "84.6% (1,015 / 1,200)" : "100% NEP 2020"}
                </h4>
                <span className="text-[11px] text-indigo-700 font-medium mt-0.5 block">
                  {isHimsDean ? "NABH Clinical Teaching Load" : "Skill-based credits active"}
                </span>
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">
                  {isHimsDean ? "Clinical Bedside Ratio" : "Student-Faculty Ratio"}
                </p>
                <h4 className="text-xl font-bold text-slate-900 mt-1">
                  {isHimsDean ? "1 : 8 Beds" : "14.2 : 1"}
                </h4>
                <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                  {isHimsDean ? "Complies with NMC Norms" : "Meets AICTE standard"}
                </span>
              </div>
            </div>

            {/* Statutory Institutional Mandate Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Statutory Authority &amp; Accreditation Mandate</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isHimsDean
                  ? "Under SRHU Statute 8.2 and National Medical Commission (NMC) regulations, Dean HIMS exercises sole jurisdiction over MBBS curriculum rotations, clinical bed allocations at the 1,200-bed Himalayan Hospital, and medical examination condonations."
                  : "Under SRHU Statute 8.2 and AICTE / UGC autonomous provisions, Director SST holds statutory authority over engineering departments (CSE, AIML, BCA), CBCS course registrations, and technical laboratory infrastructure."}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: MEDICAL CONDONATIONS */}
        {activeTab === "appeals" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Attendance Shortage Condonation Board • {isHimsDean ? "Dean HIMS Medical Panel" : "Director SST Academic Board"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHimsDean
                    ? "Statutory review of MBBS student attendance shortages supported by Himalayan Hospital discharge certificates."
                    : "Dean's discretionary authority under SRHU Statute 12.4 to condone authorized hospital admissions and official representation."}
                </p>
              </div>
              <span className="bg-amber-50 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                Statutory Board
              </span>
            </div>

            <div className="space-y-3">
              {relevantAppeals.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-slate-900 text-sm">No Pending Condonation Appeals</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    All students under {isHimsDean ? "Himalayan Institute of Medical Sciences (HIMS)" : "School of Science & Technology (SST)"} are either attendance compliant or their condonations have been duly reviewed.
                  </p>
                </div>
              ) : (
                relevantAppeals.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{app.studentName}</span>
                        <span className="font-mono text-xs text-slate-500">({app.rollNo})</span>
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Current: {app.currentPct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{app.reason}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                        <Clock className="h-3 w-3" />
                        <span>Submitted: {app.date} • Verification: Himalayan Hospital (HIMS) Medical Record #{app.hospitalDoc}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      {app.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleActionAppeal(app.id, "APPROVED")}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve Condonation
                          </button>
                          <button
                            type="button"
                            onClick={() => handleActionAppeal(app.id, "REJECTED")}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject (Debar)
                          </button>
                        </>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            app.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {app.status === "APPROVED" ? "✓ Condonation Granted" : "✕ Appeal Rejected"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CBCS / CURRICULUM ALLOTMENT */}
        {activeTab === "cbcs" && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Active Curriculum Programs &amp; Clinical Teaching Allocations ({isHimsDean ? "HIMS Medical" : "SST Engineering"})
              </h3>
              <p className="text-xs text-slate-500">
                {isHimsDean
                  ? "MBBS Competency Based Medical Education (CBME) curriculum with integrated hospital ward postings."
                  : "Autonomous curriculum credit distribution under Choice Based Credit System (CBCS)."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {schoolCourses.map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {c.code}
                      </span>
                      <span className="font-bold text-xs text-slate-900">{c.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Theory: {c.theoryHours} hrs/wk • Practical/Clinical: {c.practicalHours} hrs/wk • Credits: {c.credits}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-bold text-slate-700">Internal: {c.maxInternalMarks} / University: {c.maxExternalMarks}</span>
                    <span className="text-[10px] text-emerald-600 block font-semibold">
                      {isHimsDean ? "NMC CBME Syllabus" : "NEP-2020 Active"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: FACULTY WORKLOAD */}
        {activeTab === "workload" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Faculty Teaching &amp; Clinical Load Roster ({isHimsDean ? "HIMS Medical" : "SST Engineering"})
                </h3>
                <p className="text-xs text-slate-500">
                  {isHimsDean
                    ? "Clinical bed distribution and NMC 1:8 bedside teaching ratios at 1,200-bed Himalayan Hospital."
                    : "AICTE standard teaching workload norms: 16-18 hours/week across professorial cadre."}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                100% Cadre Compliant
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Faculty Name</th>
                    <th className="px-4 py-3">Designation</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Weekly Load</th>
                    <th className="px-4 py-3">{isHimsDean ? "Clinical Posting Venue" : "Assigned Lab"}</th>
                    <th className="px-4 py-3 text-right">Cadre Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {facultyRoster.map((fac, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">{fac.name}</td>
                      <td className="px-4 py-3 text-slate-600">{fac.designation}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{fac.dept}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{fac.hours} hrs/wk</td>
                      <td className="px-4 py-3 text-slate-600">{fac.hospitalWards}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {fac.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
