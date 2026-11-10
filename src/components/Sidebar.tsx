"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@/types";
import { useUniversity } from "@/context/UniversityContext";
import {
  Users,
  CreditCard,
  GraduationCap,
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  AlertTriangle,
  Lock,
  ShieldCheck,
  FileText,
  Search,
  UserCheck,
  KeyRound,
  LogOut,
  Send,
  Ticket,
  Printer,
  Landmark,
  Sparkles,
  Grid3x3,
  BarChart3,
  BedDouble,
  CalendarDays,
  Bus,
  Megaphone,
  FileBadge,
  HeartPulse,
  ClipboardCheck,
  RefreshCcw,
  BookMarked,
  UserPlus
} from "lucide-react";

interface SidebarProps {
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onOpenDemoCredentials: () => void;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

/** Roles that have OBE module access (Faculty edits; Dean/Registrar read reports). */
const OBE_ROLES: UserRole[] = ["SUPER_ADMIN", "FACULTY", "DEAN", "REGISTRAR_ADMIN"];

/** Roles that have accreditation reports access (Registrar/Dean). */
const REPORT_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN", "DEAN"];

/** Roles that have Academic Scheduling (Calendar + Timetable) access. */
const ACADEMIC_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FACULTY",
  "DEAN",
  "REGISTRAR_ADMIN",
  "EXAM_CONTROLLER",
  "FINANCE_OFFICER",
  "STUDENT",
];

/** Roles that have Attendance module access (Faculty marks; all view). */
const ATTENDANCE_ROLES: UserRole[] = ["SUPER_ADMIN", "FACULTY", "DEAN", "REGISTRAR_ADMIN", "STUDENT"];

/** Roles that have the Dean Governance module access (dashboard, faculty presence, messaging). */
const GOVERNANCE_ROLES: UserRole[] = ["DEAN", "REGISTRAR_ADMIN", "SUPER_ADMIN"];

/** Roles that can create delegated accounts (run an account creation hierarchy). */
const ACCOUNTS_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN", "DEAN", "FACULTY"];

/** Roles that have Hostel module access (Dean/Registrar/Finance manage; Student views own). */
const HOSTEL_ROLES: UserRole[] = ["SUPER_ADMIN", "DEAN", "REGISTRAR_ADMIN", "FINANCE_OFFICER", "STUDENT"];

/** Roles that have Library module access (all authenticated users self-serve; managers administer). */
const LIBRARY_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Transport module access (all authenticated users self-serve; staff manage). */
const TRANSPORT_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Certificates module access (students apply; staff issue/verify). */
const CERTIFICATES_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Notices module access (all view the board; staff publish). */
const NOTICES_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Grievance module access (all raise/track tickets; helpdesk manages). */
const GRIEVANCE_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Scholarships module access (students self-serve; staff manage). */
const SCHOLARSHIPS_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Health module access (students view own; staff manage). */
const HEALTH_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Clubs module access (all self-serve membership/events; staff manage). */
const CLUBS_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have HR & Payroll module access (Registrar/Finance manage; Faculty views own). */
const HR_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN", "FINANCE_OFFICER", "FACULTY"];

/** Roles that have Alumni module access (Registrar manages; Dean views; Student acts on own). */
const ALUMNI_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN", "DEAN", "STUDENT"];

/** Roles that have Audit Log access (Registrar / Central Administration only). */
const AUDIT_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Roles that have the Organization module (departments/staff/classes/allocations) access. */
const ORG_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "FACULTY",
];

/** Roles that have the Admin Console (Dynamic RBAC: roles & officer provisioning) access. */
const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN"];

/** Roles that have Course Registration module access (all authenticated users self-serve; staff read/admin). */
const REGISTRATION_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Grade Card module access (all authenticated users view; staff read/manage). */
const GRADECARD_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Backlog module access (all authenticated users view; staff read/manage). */
const BACKLOG_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FACULTY",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "STUDENT",
];

/** Roles that have Question Bank module access (staff/faculty; students have no access). */
const QUESTIONBANK_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "EXAM_CONTROLLER",
  "FACULTY",
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeRole,
  activeSection,
  onSectionChange,
  onOpenDemoCredentials,
  mobileMenuOpen = false,
  onCloseMobileMenu,
}) => {
  const { currentUser, students, gazetteLocked, appeals, logout } = useUniversity();
  const pathname = usePathname();

  const isHimsUser =
    currentUser?.schoolCode === "HIMS" ||
    currentUser?.email?.includes("rohan") ||
    currentUser?.email?.includes("sanjeev") ||
    currentUser?.email?.includes("hims");

  const activeStudent = isHimsUser
    ? students.find((s) => s.id === "stu_3") || students[0]
    : students.find((s) => s.id === "stu_1") || students[0];

  const relevantAppeals = appeals.filter((a) =>
    isHimsUser ? a.schoolId === "sch_med" : a.schoolId === "sch_eng"
  );
  const pendingAppealsCount = relevantAppeals.filter((a) => a.status === "PENDING").length;

  const studentAppeal = appeals.find((a) => a.studentId === activeStudent.id);
  const isStudentCondoned = studentAppeal?.status === "APPROVED";
  const hasAttendanceClearance = activeStudent.attendancePercentage >= (isHimsUser ? 80 : 75) || isStudentCondoned;
  const hasFeeClearance = activeStudent.feeDues === 0;
  const isStudentAdmitCardIssued = hasAttendanceClearance && hasFeeClearance;

  const handleSelectSection = (sectionId: string) => {
    onSectionChange(sectionId);
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  // Role-specific operational navigation items
  const getNavItems = (): NavItem[] => {
    switch (activeRole) {
      case "FACULTY":
        return [
          {
            id: "schedule",
            label: "Lecture Schedule",
            icon: CalendarCheck,
            badge: isHimsUser ? "PATH201" : "CS401",
            badgeColor: isHimsUser ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700",
          },
          {
            id: "attendance",
            label: isHimsUser ? "Ward & Lecture Roll-Call" : "Attendance Roll-Call",
            icon: Users,
            badge: isHimsUser ? "NMC 80/85%" : "75% UGC",
            badgeColor: "bg-emerald-50 text-emerald-700",
          },
          {
            id: "cia",
            label: isHimsUser ? "Clinical Logbook & Assessment" : "Continuous Assessment (CIA 30)",
            icon: Award,
            badge: "Active",
            badgeColor: "bg-purple-50 text-purple-700",
          },
          { id: "students", label: "Student Roll Directory", icon: BookOpen },
        ];
      case "FINANCE_OFFICER":
        return [
          { id: "counter", label: "Fee Counter & Search", icon: Search, badge: "Open", badgeColor: "bg-emerald-50 text-emerald-700" },
          { id: "defaulters", label: "Defaulters & Dues Ledger", icon: AlertTriangle, badge: "₹45,000 Due", badgeColor: "bg-rose-50 text-rose-700" },
          { id: "receipts", label: "Bank Challans & Receipts", icon: FileText, badge: "3-Part", badgeColor: "bg-indigo-50 text-indigo-700" },
          { id: "breakdown", label: "Fee Heads Schedule", icon: CreditCard },
        ];
      case "EXAM_CONTROLLER":
        return [
          { id: "tabulation", label: "Tabulation Register (TR)", icon: Award, badge: "Even 2026", badgeColor: "bg-indigo-50 text-indigo-700" },
          { id: "grading", label: "UGC 10-Point SGPA Scale", icon: ShieldCheck, badge: "Verified", badgeColor: "bg-emerald-50 text-emerald-700" },
          { id: "gazette", label: "Result Gazette Signing", icon: Lock, badge: gazetteLocked ? "Locked" : "Pending", badgeColor: gazetteLocked ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" },
          { id: "transcripts", label: "Digital Grade Cards", icon: Printer },
        ];
      case "DEAN":
        return [
          {
            id: "overview",
            label: isHimsUser ? "Dean Medical Secretariat" : "Director SST Secretariat",
            icon: Building2,
            badge: isHimsUser ? "HIMS (Medical)" : "SST (Tech)",
            badgeColor: isHimsUser ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700",
          },
          {
            id: "appeals",
            label: "Medical Condonation Board",
            icon: ShieldCheck,
            badge: `${pendingAppealsCount} Pending`,
            badgeColor: pendingAppealsCount > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
          },
          {
            id: "cbcs",
            label: isHimsUser ? "NMC CBME Rotations" : "NEP-2020 CBCS Allotment",
            icon: BookOpen,
            badge: "Autonomous",
            badgeColor: "bg-indigo-50 text-indigo-700",
          },
          { id: "workload", label: "Faculty Workload Ratios", icon: Users },
        ];
      case "STUDENT":
        return [
          {
            id: "overview",
            label: "Academic Snapshot",
            icon: UserCheck,
            badge: isHimsUser ? "MBBS Prof 2" : "Sem 4",
            badgeColor: isHimsUser ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700",
          },
          {
            id: "attendance",
            label: isHimsUser ? "NMC 80/85% Attendance" : "75% UGC Attendance",
            icon: CalendarCheck,
            badge: `${activeStudent.attendancePercentage}%`,
            badgeColor:
              activeStudent.attendancePercentage < (isHimsUser ? 80 : 75)
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-700",
          },
          {
            id: "fees",
            label: "Fee Dues & Online Pay",
            icon: CreditCard,
            badge: activeStudent.feeDues > 0 ? `₹${activeStudent.feeDues.toLocaleString()}` : "Clear",
            badgeColor: activeStudent.feeDues > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
          },
          {
            id: "admit-card",
            label: "Exam Hall Ticket",
            icon: Ticket,
            badge: isStudentAdmitCardIssued ? "Issued" : "Hold",
            badgeColor: isStudentAdmitCardIssued ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
          },
          {
            id: "results",
            label: "Grade Cards & SGPA",
            icon: GraduationCap,
            badge: `${activeStudent.academicPerformance.cgpa.toFixed(2)} CGPA`,
            badgeColor: "bg-purple-50 text-purple-700",
          },
        ];
      case "REGISTRAR_ADMIN":
        return [
          { id: "overview", label: "Secretariat Overview", icon: Building2, badge: "Central", badgeColor: "bg-slate-100 text-slate-700" },
          { id: "admissions", label: "Admissions Counseling", icon: Users, badge: "Merit Rank", badgeColor: "bg-indigo-50 text-indigo-700" },
          { id: "allotment", label: "Provisional Seat Allotment", icon: FileText, badge: "Letters", badgeColor: "bg-emerald-50 text-emerald-700" },
          { id: "schools", label: "Constituent Schools", icon: Landmark, badge: "6 Schools", badgeColor: "bg-blue-50 text-blue-700" },
          { id: "naac", label: "NAAC Criteria 1–7", icon: Award, badge: "Grade A+", badgeColor: "bg-amber-50 text-amber-700" },
          { id: "circulars", label: "Statutory Circulars", icon: Send, badge: "Dispatched", badgeColor: "bg-purple-50 text-purple-700" },
        ];
      case "SUPER_ADMIN":
        return [
          { id: "overview", label: "University Secretariat Overview", icon: Building2, badge: "Central", badgeColor: "bg-slate-100 text-slate-700" },
          { id: "admissions", label: "Admissions Counseling", icon: Users, badge: "Merit Rank", badgeColor: "bg-indigo-50 text-indigo-700" },
          { id: "allotment", label: "Provisional Seat Allotment", icon: FileText, badge: "Letters", badgeColor: "bg-emerald-50 text-emerald-700" },
          { id: "schools", label: "Constituent Schools", icon: Landmark, badge: "6 Schools", badgeColor: "bg-blue-50 text-blue-700" },
          { id: "naac", label: "NAAC Criteria 1–7", icon: Award, badge: "Grade A+", badgeColor: "bg-amber-50 text-amber-700" },
          { id: "circulars", label: "Statutory Circulars", icon: Send, badge: "Dispatched", badgeColor: "bg-purple-50 text-purple-700" },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={onCloseMobileMenu}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Primary Sidebar Rail */}
      <aside
        className={`fixed md:sticky top-16 z-40 w-72 h-[calc(100vh-4rem)] bg-white border-r border-slate-200/90 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Active Persona & Quick Role Switcher Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-2xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                  {currentUser?.avatarInitials || "SR"}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs text-slate-900 truncate">
                    {currentUser?.name || "Active Session"}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    {currentUser?.designation || "University Officer"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {currentUser?.schoolCode || "SRHU"} • Active Role
              </span>
              <button
                type="button"
                onClick={onOpenDemoCredentials}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                title="Switch persona with 1 click"
              >
                <KeyRound className="h-3 w-3 text-amber-300" />
                <span>Switch ⚡</span>
              </button>
            </div>
          </div>

          {/* Departmental Operational Navigation Header */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Workspace Operations
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                Active
              </span>
            </div>

            {/* Navigation Links */}
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isActive
                      ? "bg-slate-900 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isActive
                          ? "bg-slate-800 text-slate-200"
                          : item.badgeColor || "bg-slate-100 text-slate-600"
                          }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {OBE_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · OBE
              </span>
              <div className="space-y-1">
                <Link
                  href="/obe/course-outcomes"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/obe")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <Grid3x3 className={`h-4 w-4 shrink-0 ${pathname.startsWith("/obe") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">OBE · Outcomes</span>
                </Link>
              </div>
            </div>
          )}

          {REPORT_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Reports
              </span>
              <div className="space-y-1">
                <Link
                  href="/reports/naac"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/reports")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <BarChart3 className={`h-4 w-4 shrink-0 ${pathname.startsWith("/reports") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">NAAC / NBA / NIRF</span>
                </Link>
              </div>
            </div>
          )}

          {ACADEMIC_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Academic
              </span>
              <div className="space-y-1">
                <Link
                  href="/academic/calendar"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/academic")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <CalendarDays className={`h-4 w-4 shrink-0 ${pathname.startsWith("/academic") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Academic · Calendar & Timetable</span>
                </Link>
              </div>
            </div>
          )}

          {ATTENDANCE_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Attendance
              </span>
              <div className="space-y-1">
                <Link
                  href="/attendance/mark"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/attendance")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <CalendarCheck className={`h-4 w-4 shrink-0 ${pathname.startsWith("/attendance") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Attendance · Roll-Call</span>
                </Link>
              </div>
            </div>
          )}

          {HOSTEL_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Hostel
              </span>
              <div className="space-y-1">
                <Link
                  href="/hostel/rooms"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/hostel")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <BedDouble className={`h-4 w-4 shrink-0 ${pathname.startsWith("/hostel") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Hostel · Rooms & Bills</span>
                </Link>
              </div>
            </div>
          )}

          {LIBRARY_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Library
              </span>
              <div className="space-y-1">
                <Link
                  href="/library/catalogue"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/library")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <BookOpen className={`h-4 w-4 shrink-0 ${pathname.startsWith("/library") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Library</span>
                </Link>
              </div>
            </div>
          )}

          {TRANSPORT_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Transport
              </span>
              <div className="space-y-1">
                <Link
                  href="/transport"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/transport")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <Bus className={`h-4 w-4 shrink-0 ${pathname.startsWith("/transport") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Transport · Routes & Passes</span>
                </Link>
              </div>
            </div>
          )}

          {CERTIFICATES_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Certificates
              </span>
              <div className="space-y-1">
                <Link
                  href="/certificates/my"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/certificates")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <FileBadge className={`h-4 w-4 shrink-0 ${pathname.startsWith("/certificates") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Certificates</span>
                </Link>
              </div>
            </div>
          )}

          {NOTICES_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Notices
              </span>
              <div className="space-y-1">
                <Link
                  href="/notices"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/notices")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <Megaphone className={`h-4 w-4 shrink-0 ${pathname.startsWith("/notices") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Notices · Board</span>
                </Link>
              </div>
            </div>
          )}

          {ACCOUNTS_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Accounts
              </span>
              <div className="space-y-1">
                <Link
                  href="/accounts"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/accounts")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <UserPlus className={`h-4 w-4 shrink-0 ${pathname.startsWith("/accounts") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Accounts · Create & Roles</span>
                </Link>
              </div>
            </div>
          )}

          {GRIEVANCE_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Grievance
              </span>
              <div className="space-y-1">
                <Link
                  href="/grievance"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/grievance")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${pathname.startsWith("/grievance") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Grievance · Helpdesk</span>
                </Link>
              </div>
            </div>
          )}

          {SCHOLARSHIPS_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Scholarships
              </span>
              <div className="space-y-1">
                <Link
                  href="/scholarships"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/scholarships")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <Award className={`h-4 w-4 shrink-0 ${pathname.startsWith("/scholarships") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Scholarships</span>
                </Link>
              </div>
            </div>
          )}

          {HEALTH_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Health
              </span>
              <div className="space-y-1">
                <Link
                  href="/health"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/health")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <HeartPulse className={`h-4 w-4 shrink-0 ${pathname.startsWith("/health") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Health · Clinic</span>
                </Link>
              </div>
            </div>
          )}

          {CLUBS_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Clubs
              </span>
              <div className="space-y-1">
                <Link
                  href="/clubs"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/clubs")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <Users className={`h-4 w-4 shrink-0 ${pathname.startsWith("/clubs") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Clubs · Events</span>
                </Link>
              </div>
            </div>
          )}

          {HR_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · HR &amp; Payroll
              </span>
              <div className="space-y-1">
                <Link
                  href="/hr/employees"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/hr")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <Users className={`h-4 w-4 shrink-0 ${pathname.startsWith("/hr") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">HR &amp; Payroll</span>
                </Link>
              </div>
            </div>
          )}

          {ALUMNI_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Alumni
              </span>
              <div className="space-y-1">
                <Link
                  href="/alumni/directory"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/alumni")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <GraduationCap className={`h-4 w-4 shrink-0 ${pathname.startsWith("/alumni") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Alumni</span>
                </Link>
              </div>
            </div>
          )}

          {AUDIT_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Audit
              </span>
              <div className="space-y-1">
                <Link
                  href="/audit"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/audit")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <ShieldCheck className={`h-4 w-4 shrink-0 ${pathname.startsWith("/audit") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Audit Log · Trail</span>
                </Link>
              </div>
            </div>
          )}

          {ORG_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Organization
              </span>
              <div className="space-y-1">
                {[
                  { href: "/org/departments", label: "Departments", icon: Building2 },
                  { href: "/org/staff", label: "Staff", icon: Users },
                  { href: "/org/classes", label: "Classes", icon: BookOpen },
                  { href: "/org/allocations", label: "Allocations", icon: Grid3x3 },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${active
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {GOVERNANCE_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Governance
              </span>
              <div className="space-y-1">
                {[
                  { href: "/governance/dashboard", label: "Dean Dashboard", icon: Building2 },
                  { href: "/governance/faculty-presence", label: "Faculty Presence", icon: Users },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${active
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {ADMIN_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Admin
              </span>
              <div className="space-y-1">
                <Link
                  href="/admin"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/admin")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <KeyRound className={`h-4 w-4 shrink-0 ${pathname.startsWith("/admin") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Roles & Officers</span>
                </Link>
              </div>
            </div>
          )}

          {REGISTRATION_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Registration
              </span>
              <div className="space-y-1">
                <Link
                  href="/registration/catalog"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/registration")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <ClipboardCheck className={`h-4 w-4 shrink-0 ${pathname.startsWith("/registration") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Registration · Courses</span>
                </Link>
              </div>
            </div>
          )}

          {GRADECARD_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Grade Card
              </span>
              <div className="space-y-1">
                <Link
                  href="/gradecard/my"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/gradecard")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <GraduationCap className={`h-4 w-4 shrink-0 ${pathname.startsWith("/gradecard") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Grade Card · SGPA</span>
                </Link>
              </div>
            </div>
          )}

          {BACKLOG_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Backlog
              </span>
              <div className="space-y-1">
                <Link
                  href="/backlog/my"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/backlog")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <RefreshCcw className={`h-4 w-4 shrink-0 ${pathname.startsWith("/backlog") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Backlog · Reval & Supp</span>
                </Link>
              </div>
            </div>
          )}

          {QUESTIONBANK_ROLES.includes(activeRole) && (
            <div className="mt-2 pt-3 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 block">
                Module · Question Bank
              </span>
              <div className="space-y-1">
                <Link
                  href="/questionbank/questions"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${pathname.startsWith("/questionbank")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <BookMarked className={`h-4 w-4 shrink-0 ${pathname.startsWith("/questionbank") ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Question Bank</span>
                </Link>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Sidebar Institutional Badge & Session Info */}
        <div className="p-4 border-t border-slate-200/90 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-medium text-[11px]">Academic Session</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              Spring 2026
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[11px] text-slate-400">NAAC Grade A+ (3.42)</span>
            <button
              onClick={logout}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
