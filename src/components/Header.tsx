"use client";

import React from "react";
import { CONSTITUENT_SCHOOLS } from "@/data/mockData";
import { UserRole } from "@/types";
import { useUniversity } from "@/context/UniversityContext";
import { NotificationBell } from "@/components/NotificationBell";
import {
  ShieldCheck,
  ChevronDown,
  Building2,
  Search,
  Menu,
  X,
  KeyRound,
  LogOut,
  Lock
} from "lucide-react";

interface HeaderProps {
  activeSchoolId: string;
  onSchoolChange: (schoolId: string) => void;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onOpenSearch?: () => void;
  onOpenDemoCredentials?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSchoolId,
  onSchoolChange,
  mobileMenuOpen,
  onToggleMobileMenu,
  onOpenSearch,
  onOpenDemoCredentials,
  onLogout,
}) => {
  const { currentUser } = useUniversity();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">

          {/* Brand & Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-sm tracking-tighter shrink-0 shadow-xs">
              SRHU
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base truncate">
                  Swami Rama Himalayan University
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="h-3 w-3" />
                  NAAC A+ (3.42)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate hidden md:block">
                University Management System (UMS) • Autonomous Campus SaaS
              </p>
            </div>
          </div>

          {/* Quick Universal Search (Ctrl+K) */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-400 hover:text-slate-600 text-xs transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span>Search student, course, challan...</span>
              </div>
              <kbd className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Constituent School Selector or Institutional Unit Lock */}
            <div className="hidden md:flex items-center">
              {currentUser?.isCentral ? (
                <div className="relative">
                  <select
                    aria-label="Select Constituent School"
                    value={activeSchoolId}
                    onChange={(e) => onSchoolChange(e.target.value)}
                    className="appearance-none bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-xl pl-8 pr-8 py-2 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer transition-colors shadow-2xs"
                  >
                    <option value="ALL">🏛️ All Constituent Schools</option>
                    {CONSTITUENT_SCHOOLS.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.code} — {school.name}
                      </option>
                    ))}
                  </select>
                  <Building2 className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <ChevronDown className="h-3 w-3 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs"
                  title={`Jurisdiction strictly restricted to ${currentUser?.schoolCode} under SRHU Statute 8.2`}
                >
                  <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>
                    Unit: <strong className="text-slate-900">{currentUser?.schoolCode}</strong> ({CONSTITUENT_SCHOOLS.find((s) => s.code === currentUser?.schoolCode)?.name?.split("(")[0].trim() || currentUser?.schoolCode})
                  </span>
                  <Lock className="h-3 w-3 text-slate-400 ml-1 shrink-0" />
                </div>
              )}
            </div>

            {/* 1-Click Role-Based Demo Credentials Button */}
            {onOpenDemoCredentials && (
              <button
                type="button"
                onClick={onOpenDemoCredentials}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Switch persona with 1-click test credentials"
              >
                <KeyRound className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">Demo Switcher ⚡</span>
                <span className="sm:hidden font-mono text-[10px]">Demo</span>
              </button>
            )}

            {/* Notifications Bell */}
            <NotificationBell />

            {/* Authenticated User Capsule & Sign Out */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser?.avatarInitials || "SR"}
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{currentUser?.designation}</p>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Logout of UMS"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Sign out of UMS"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
