"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { FacultyWorkspace } from "@/components/portal/FacultyWorkspace";
import { FinanceWorkspace } from "@/components/portal/FinanceWorkspace";
import { ExamControllerWorkspace } from "@/components/portal/ExamControllerWorkspace";
import { DeanWorkspace } from "@/components/portal/DeanWorkspace";
import { StudentWorkspace } from "@/components/portal/StudentWorkspace";
import { RegistrarWorkspace } from "@/components/portal/RegistrarWorkspace";
import { GlobalCommandPalette } from "@/components/GlobalCommandPalette";
import { KpiStrip } from "@/components/KpiStrip";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DemoCredentialsModal } from "@/components/auth/DemoCredentialsModal";
import { LoginView } from "@/components/auth/LoginView";
import { UniversityProvider, useUniversity } from "@/context/UniversityContext";
import { UserRole } from "@/types";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Sparkles
} from "lucide-react";

// Default start sections for each role
const DEFAULT_SECTIONS: Record<UserRole, string> = {
  FACULTY: "attendance",
  FINANCE_OFFICER: "counter",
  EXAM_CONTROLLER: "tabulation",
  DEAN: "appeals",
  STUDENT: "overview",
  PARENT: "overview",
  REGISTRAR_ADMIN: "admissions",
  SUPER_ADMIN: "overview",
};

function UMSDashboard() {
  const { currentUser, initializing, loginAsRole, logout, toast, clearToast } = useUniversity();
  const [activeRole, setActiveRole] = useState<UserRole>(currentUser?.role || "FACULTY");
  const [activeSection, setActiveSection] = useState<string>(DEFAULT_SECTIONS[currentUser?.role || "FACULTY"]);
  const [activeSchoolId, setActiveSchoolId] = useState<string>("ALL");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isDemoCredentialsOpen, setIsDemoCredentialsOpen] = useState<boolean>(false);

  // Sync active role and enforce strict multi-tenant school jurisdiction
  useEffect(() => {
    if (currentUser) {
      setActiveRole(currentUser.role);
      setActiveSection(DEFAULT_SECTIONS[currentUser.role] || "overview");

      // SRHU Statute 8.2 Multi-Tenant Jurisdiction Lock:
      // Departmental users (SST vs HIMS) are strictly locked to their assigned constituent schoolId.
      // Central University Officers (Registrar, FO, COE) hold cross-school jurisdiction ("ALL").
      if (!currentUser.isCentral) {
        setActiveSchoolId(currentUser.schoolId);
      } else {
        if (currentUser.schoolId === "ALL") {
          setActiveSchoolId((prev) => (prev === "sch_eng" || prev === "sch_med" ? prev : "ALL"));
        } else {
          setActiveSchoolId(currentUser.schoolId);
        }
      }
    }
  }, [currentUser]);

  // Keyboard shortcut listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSchoolChange = (schoolId: string) => {
    // Non-central officers CANNOT change constituent schools under statute 8.2
    if (!currentUser?.isCentral) {
      return;
    }
    setActiveSchoolId(schoolId);
  };

  const applyRoleSelection = (role: UserRole) => {
    setActiveRole(role);
    setActiveSection(DEFAULT_SECTIONS[role] || "overview");
  };

  // Called after the real server login succeeds (LoginView) — the session is
  // already authenticated, so we only apply the workspace selection here and do
  // NOT re-login or fabricate any persona.
  const handleLoginSuccess = (role: UserRole) => {
    applyRoleSelection(role);
  };

  // Persona/role switching between authenticated sessions goes through a
  // server-verified login (no client-side impersonation). The workspace only
  // changes if the server actually authenticates the persona credentials.
  const handleRoleChange = async (role: UserRole) => {
    if (currentUser?.role === role) {
      applyRoleSelection(role);
      return;
    }
    const result = await loginAsRole(
      role,
      !currentUser?.isCentral ? currentUser?.schoolCode : undefined
    );
    if (result.user) {
      applyRoleSelection(role);
    }
  };

  // While hydrating the session from GET /api/auth/me, show a lightweight loader so we
  // don't flash the sign-in screen to an already authenticated user.
  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans antialiased">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Restoring your session…</p>
        </div>
      </div>
    );
  }

  // If user is logged out, render the modern SRHU single sign-on view with persona autofill cards.
  if (!currentUser) {
    return <LoginView onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800 selection:bg-indigo-500 selection:text-white">

      {/* Real-Time Cross-Role Dynamic Toast Stack */}
      {toast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-auto p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-2xl border border-slate-700/80 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}
          {toast.type === "warning" && <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />}
          {toast.type === "info" && <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-0.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Real-Time University Sync</span>
            </div>
            <p className="text-xs text-slate-100 font-medium leading-relaxed">{toast.message}</p>
          </div>
          <button
            onClick={clearToast}
            aria-label="Close notification"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </aside>
      )}

      {/* Sticky Modern University Header */}
      <Header
        activeSchoolId={activeSchoolId}
        onSchoolChange={handleSchoolChange}
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        onOpenDemoCredentials={() => setIsDemoCredentialsOpen(true)}
        onLogout={logout}
      />

      {/* Main University Layout Area */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto relative min-w-0">

        {/* Navigation Sidebar (Dynamic Department Operations) */}
        <Sidebar
          activeRole={activeRole}
          onRoleChange={handleRoleChange}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onOpenDemoCredentials={() => setIsDemoCredentialsOpen(true)}
          mobileMenuOpen={mobileMenuOpen}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
        />

        {/* Dynamic Operational Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <KpiStrip />
          <DashboardCharts />
          {activeRole === "FACULTY" && (
            <FacultyWorkspace activeSchoolId={activeSchoolId} activeSection={activeSection} />
          )}
          {activeRole === "FINANCE_OFFICER" && (
            <FinanceWorkspace activeSchoolId={activeSchoolId} activeSection={activeSection} />
          )}
          {activeRole === "EXAM_CONTROLLER" && (
            <ExamControllerWorkspace activeSchoolId={activeSchoolId} activeSection={activeSection} />
          )}
          {activeRole === "DEAN" && (
            <DeanWorkspace activeSchoolId={activeSchoolId} activeSection={activeSection} />
          )}
          {activeRole === "STUDENT" && (
            <StudentWorkspace activeSchoolId={activeSchoolId} activeSection={activeSection} />
          )}
          {(activeRole === "REGISTRAR_ADMIN" || activeRole === "SUPER_ADMIN") && (
            <RegistrarWorkspace activeSchoolId={activeSchoolId} activeSection={activeSection} />
          )}
        </main>

      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <GlobalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectRole={handleRoleChange}
      />

      {/* 1-Click Role-Based Demo Credentials Modal */}
      <DemoCredentialsModal
        isOpen={isDemoCredentialsOpen}
        onClose={() => setIsDemoCredentialsOpen(false)}
      />

    </div>
  );
}

export default function Home() {
  return (
    <UniversityProvider>
      <UMSDashboard />
    </UniversityProvider>
  );
}
