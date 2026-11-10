"use client";

import React, { useState } from "react";
import {
  Building2,
  Users,
  Award,
  FileText,
  Plus,
  Send,
  Building,
  ChevronRight,
  Printer,
  QrCode
} from "lucide-react";
import { CONSTITUENT_SCHOOLS, ADMISSION_APPLICATIONS, NAAC_METRICS } from "@/data/mockData";
import { AdmissionApplication } from "@/types";

interface RegistrarWorkspaceProps {
  activeSchoolId?: string;
  activeSection?: string;
}

export const RegistrarWorkspace: React.FC<RegistrarWorkspaceProps> = ({
  activeSchoolId = "ALL",
  activeSection = "overview",
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "admissions" | "schools" | "naac" | "circulars">("overview");

  React.useEffect(() => {
    if (activeSection) {
      if (activeSection === "allotment") {
        setActiveTab("admissions");
      } else if (["overview", "admissions", "schools", "naac", "circulars"].includes(activeSection)) {
        setActiveTab(activeSection as "overview" | "admissions" | "schools" | "naac" | "circulars");
      }
    }
  }, [activeSection]);
  const [showCircularModal, setShowCircularModal] = useState<boolean>(false);
  const [selectedAppForLetter, setSelectedAppForLetter] = useState<AdmissionApplication | null>(null);
  const [circularTitle, setCircularTitle] = useState<string>("");
  const [circularBody, setCircularBody] = useState<string>("");
  const [circularsList, setCircularsList] = useState([
    {
      id: "CIRC-2026-089",
      date: "02-Mar-2026",
      category: "ACADEMIC",
      title: "Schedule for End Semester Theory & Practical Examinations (Even Sem 2026)",
      recipient: "All Constituent Schools (SST, SMS, HIMS, SBS, HCN, SPS)",
      status: "Published",
    },
    {
      id: "CIRC-2026-088",
      date: "26-Feb-2026",
      category: "STATUTORY",
      title: "Notice for 24th Meeting of the Academic Council regarding NEP 2020 Curriculum Revision",
      recipient: "All Deans, HODs and Professorial Cadre",
      status: "Published",
    },
    {
      id: "CIRC-2026-087",
      date: "18-Feb-2026",
      category: "ADMINISTRATIVE",
      title: "Mandatory Submission of Self-Appraisal Reports (PBAS) for Faculty CAS Promotion",
      recipient: "All Regular Faculty Members",
      status: "Dispatched",
    },
  ]);

  const handlePublishCircular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!circularTitle.trim()) return;

    const newCirc = {
      id: `CIRC-2026-0${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      category: "ACADEMIC",
      title: circularTitle,
      recipient: "All Constituent Schools & Departments",
      status: "Published",
    };

    setCircularsList([newCirc, ...circularsList]);
    setCircularTitle("");
    setCircularBody("");
    setShowCircularModal(false);
  };

  const displayedSchools = activeSchoolId === "ALL"
    ? CONSTITUENT_SCHOOLS
    : CONSTITUENT_SCHOOLS.filter((s) => s.id === activeSchoolId);

  const displayedApps = activeSchoolId === "ALL"
    ? ADMISSION_APPLICATIONS
    : ADMISSION_APPLICATIONS.filter((a) => a.schoolId === activeSchoolId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Office of the Registrar Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-950 text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0">
              <Building2 className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Office of the Registrar
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Statutory Secretariat
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  SRHU Dehradun
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-y-1 gap-x-3">
                <span className="font-medium text-slate-800">Registrar: Cdr. Challa Venkateswar (Retd.)</span>
                <span>•</span>
                <span>UGC 2(f) State Private University</span>
                <span>•</span>
                <span>Academic Session 2026-27</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Constituent Schools</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">6 Units</p>
              <span className="text-[10px] text-indigo-600 font-semibold">SST, SMS, HIMS, SBS, HCN, SPS</span>
            </div>
            <div className="h-10 w-px bg-slate-200 hidden sm:block" />
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total On-Campus</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">5,840</p>
              <span className="text-[10px] text-slate-500">UG, PG &amp; Doctoral</span>
            </div>
            <div className="h-10 w-px bg-slate-200 hidden sm:block" />
            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">NAAC Standing</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">Grade A+</p>
              <span className="text-[10px] text-emerald-600 font-semibold">3.42 / 4.0 CGPA</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100 overflow-x-auto">
          {[
            { id: "overview", label: "Executive University Overview", icon: Building },
            { id: "admissions", label: "Central Admissions Counseling", icon: Users },
            { id: "schools", label: "Constituent Schools & Masters", icon: Building2 },
            { id: "naac", label: "NAAC Criteria 1–7 Compliance", icon: Award },
            { id: "circulars", label: "Gazette & Statutory Circulars", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "overview" | "admissions" | "schools" | "naac" | "circulars")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase">Admissions Intake</span>
              <p className="text-2xl font-black text-slate-900 mt-1">1,450 / 1,600</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">90.6% Sanctioned Seats Filled</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase">Faculty Strength</span>
              <p className="text-2xl font-black text-slate-900 mt-1">450 Regular</p>
              <p className="text-[11px] text-slate-500 mt-1">Cadre Ratio: 1:2:6 Maintained</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase">UGC 75% Compliance</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">94.8%</p>
              <p className="text-[11px] text-slate-500 mt-1">Across 6 Constituent Units</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase">Tuition Fee Realization</span>
              <p className="text-2xl font-black text-indigo-600 mt-1">94.6%</p>
              <p className="text-[11px] text-indigo-700 font-medium mt-1">₹34.8 Cr Collected</p>
            </div>
          </div>

          {/* School-wise Roll-up */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Constituent Schools Status Matrix</h3>
                <p className="text-xs text-slate-500">Autonomous schools under Swami Rama Himalayan University umbrella</p>
              </div>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                6 Academic Councils
              </span>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {displayedSchools.map((school) => (
                <div key={school.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {school.code}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{school.name}</h4>
                      <p className="text-xs text-slate-500">
                        Director / Dean: <span className="font-medium text-slate-700">{school.deanName}</span> • Est. {school.establishedYear} • {school.programsCount} Approved Degree Programs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Regulatory Approval</p>
                      <p className="text-xs font-bold text-slate-800">
                        {school.code === "HIMS" ? "NMC / DCI / INC" : school.code === "SST" ? "AICTE / UGC" : "UGC Approved"}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-xs border border-emerald-200">
                      Active Session
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CENTRAL ADMISSIONS */}
      {activeTab === "admissions" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <h3 className="font-bold text-slate-900 text-base mb-1">Admissions &amp; Enrollment Pipeline (AY 2026-27)</h3>
            <p className="text-xs text-slate-500 mb-6">Centralized entrance, merit preparation, counseling &amp; registration funnel</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-xs text-slate-500 font-medium">Stage 1: Applications</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">1,240</p>
                <span className="text-[10px] text-slate-500">Portal Submissions</span>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 text-center">
                <p className="text-xs text-indigo-700 font-medium">Stage 2: Verified</p>
                <p className="text-2xl font-bold text-indigo-900 mt-1">890</p>
                <span className="text-[10px] text-indigo-600 font-medium">Documents Audited</span>
              </div>
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-center">
                <p className="text-xs text-amber-700 font-medium">Stage 3: Seats Frozen</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">412</p>
                <span className="text-[10px] text-amber-600 font-medium">Counseling Rounds</span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-center">
                <p className="text-xs text-emerald-700 font-medium">Stage 4: Enrolled</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">368</p>
                <span className="text-[10px] text-emerald-600 font-medium">Fee Paid &amp; Enrolled</span>
              </div>
            </div>

            {/* Application List with 1-Click Allotment Letter */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-900 text-sm">Direct Admission Counseling Merit List</h4>
                <span className="text-xs text-slate-500">Click &apos;Allotment Letter&apos; to view official provisional offer</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                      <th className="py-2.5 px-3">Application No</th>
                      <th className="py-2.5 px-3">Candidate Name</th>
                      <th className="py-2.5 px-3">Program Applied</th>
                      <th className="py-2.5 px-3">Merit % / Score</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Official Offer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedApps.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-slate-900">{app.applicationNo}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{app.candidateName}</td>
                        <td className="py-3 px-3 text-slate-600">{app.programApplied}</td>
                        <td className="py-3 px-3 font-mono text-slate-800">{app.qualifyingExamScore ? `${app.qualifyingExamScore}` : "Pending"}</td>
                        <td className="py-3 px-3 text-slate-500">{app.category}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            app.status === "ENROLLED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : app.status === "SEAT_FROZEN"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedAppForLetter(app)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <FileText className="h-3 w-3 text-indigo-600" />
                            <span>Allotment Letter</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONSTITUENT SCHOOLS */}
      {activeTab === "schools" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedSchools.map((school) => (
              <div key={school.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs">
                    {school.code}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Est. {school.establishedYear}</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{school.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Director / Dean: <strong className="text-slate-800">{school.deanName}</strong></p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Degree Programs:</span>
                    <p className="font-bold text-slate-900">{school.programsCount} Programs</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Autonomous Council:</span>
                    <p className="font-bold text-emerald-700">Constituted</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-slate-500">Academic Regulations: SRHU 2026</span>
                  <button
                    onClick={() => alert(`Opening Master Program Registry for ${school.name}`)}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Programs</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: NAAC CRITERIA */}
      {activeTab === "naac" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">NAAC Accreditation Standing &amp; Scorecard</h3>
                <p className="text-xs text-slate-500">National Assessment and Accreditation Council • Internal Quality Assurance Cell (IQAC)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                  Current: Grade A+ (3.42 / 4.0)
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 mt-4 text-xs">
              {NAAC_METRICS.map((crit) => (
                <div key={crit.criterionId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      C{crit.criterionId}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{crit.criterionTitle}</h4>
                      <p className="text-slate-500 text-xs">Key Indicator: {crit.keyIndicator} • Weightage: {crit.weightage}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-slate-500 text-[11px]">Current Score</p>
                      <p className="font-mono font-bold text-emerald-600 text-base">{crit.currentScore} / {crit.maxScore}</p>
                    </div>
                    <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${(crit.currentScore / crit.maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: STATUTORY CIRCULARS */}
      {activeTab === "circulars" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Official University Circulars &amp; Gazettes</h3>
                <p className="text-xs text-slate-500">Statutory publications issued under authority of the Registrar (Cdr. Challa Venkateswar)</p>
              </div>
              <button
                onClick={() => setShowCircularModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Issue New Circular</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-4 text-xs">
              {circularsList.map((circ) => (
                <div key={circ.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{circ.id}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        {circ.category}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">{circ.date}</span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm mt-1">{circ.title}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">Recipients: {circ.recipient}</p>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
                      {circ.status}
                    </span>
                    <button
                      onClick={() => alert(`Circular ${circ.id} printed on official SRHU Registrar letterhead.`)}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 font-medium cursor-pointer"
                    >
                      View Notice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Provisional Admission Offer / Seat Allotment Letter Modal */}
      {selectedAppForLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Actions Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Official Provisional Admission Offer Letter (AY 2026-27)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Letter</span>
                </button>
                <button
                  onClick={() => setSelectedAppForLetter(null)}
                  className="text-slate-400 hover:text-white font-bold p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Letter Body */}
            <div className="p-6 sm:p-8 space-y-6 text-xs text-slate-800 font-serif leading-relaxed max-h-[80vh] overflow-y-auto">
              {/* Header Letterhead */}
              <div className="border-b-2 border-slate-800 pb-4 text-center">
                <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  Swami Rama Himalayan University
                </h2>
                <p className="text-[11px] text-slate-600 font-sans">
                  Swami Ram Nagar, Jolly Grant, Dehradun - 248016, Uttarakhand
                </p>
                <p className="text-[11px] font-sans font-bold text-indigo-700 mt-0.5">
                  OFFICE OF THE REGISTRAR • CENTRAL ADMISSIONS COMMITTEE
                </p>
                <div className="flex justify-between items-center text-[10px] font-sans font-medium text-slate-500 mt-3 pt-2 border-t border-slate-200">
                  <span>Ref: SRHU/ADM/2026/ALLOT-{selectedAppForLetter.applicationNo}</span>
                  <span>Date: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              </div>

              {/* Salutation & Subject */}
              <div>
                <p className="font-sans font-semibold">To,</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedAppForLetter.candidateName}</p>
                <p className="font-mono text-slate-600 text-[11px]">Application No: {selectedAppForLetter.applicationNo}</p>
                <p className="text-slate-600 text-[11px]">Category: {selectedAppForLetter.category} Quota</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-sans text-xs">
                <strong className="text-slate-900">Subject: </strong>
                <span>Provisional Allotment of Seat for Admission to Academic Year 2026-27</span>
              </div>

              <p>
                Dear Candidate, we are pleased to inform you that based on your performance in the qualifying entrance / merit examination (Score/Rank: <strong>{selectedAppForLetter.qualifyingExamScore}</strong>) and subsequent centralized counseling, you have been <strong>provisionally selected for admission</strong> to the following program:
              </p>

              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 font-sans text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-indigo-900 font-medium">Allotted Degree Program:</span>
                  <strong className="text-indigo-950">{selectedAppForLetter.programApplied}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-900 font-medium">Constituent School:</span>
                  <span className="font-bold text-indigo-950">
                    {CONSTITUENT_SCHOOLS.find((s) => s.id === selectedAppForLetter.schoolId)?.name || "School of Science & Technology (SST)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-900 font-medium">Allotment Status:</span>
                  <span className="font-bold text-emerald-700">{selectedAppForLetter.status}</span>
                </div>
              </div>

              <p>
                Please report to the University Admissions Office at Central Block along with your original certificates (10th, 12th/Graduation Marksheet, Transfer Certificate, Category Certificate, and Medical Fitness Certificate issued by Himalayan Hospital HIMS) by the stipulated date.
              </p>

              {/* Signatures & Seal */}
              <div className="pt-6 border-t border-slate-200 flex items-end justify-between font-sans">
                <div className="flex items-center gap-2">
                  <QrCode className="h-12 w-12 text-slate-800" />
                  <div className="text-[10px] text-slate-500">
                    <p className="font-bold text-slate-800">Digitally Verified Document</p>
                    <p className="font-mono">SRHU-ADM-SEAL-2026</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-serif italic font-bold text-slate-900 text-sm">Cdr. Challa Venkateswar (Retd.)</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Registrar, SRHU</p>
                  <p className="text-[10px] text-indigo-700 font-semibold">Swami Rama Himalayan University</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* New Circular Modal */}
      {showCircularModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Issue University Circular / Notification</h3>
                <p className="text-xs text-slate-400">Published under authority of the Registrar (Cdr. Challa Venkateswar)</p>
              </div>
              <button
                onClick={() => setShowCircularModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishCircular} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Circular Subject / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Revised Submission Dates for End-Sem Practical Records..."
                  value={circularTitle}
                  onChange={(e) => setCircularTitle(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Recipient Category</label>
                <select className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white">
                  <option>All Constituent Schools (SST, SMS, HIMS, SBS, HCN, SPS)</option>
                  <option>Faculty &amp; Academic Staff Only</option>
                  <option>Enrolled Students &amp; Hostellers</option>
                  <option>Accounts &amp; Finance Wing</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Body Text / Resolution</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter official resolution or statutory order text..."
                  value={circularBody}
                  onChange={(e) => setCircularBody(e.target.value)}
                  className="w-full text-xs p-3.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCircularModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Publish &amp; Broadcast Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
