"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  KeyRound,
  UserPlus,
  FileText,
  Users,
  GraduationCap,
  ArrowRight,
} from "lucide-react";

interface AdminWorkspaceProps {
  activeSchoolId?: string;
  activeSection?: string;
}

interface QuickLaunch {
  id: string;
  href: string;
  title: string;
  desc: string;
  icon: React.ElementType;
}

/**
 * Platform administration quick-launch cards. SUPER_ADMIN is the only role that
 * ever reaches the Admin Console (`/admin`), Audit Log (`/audit`) and delegated
 * accounts (`/accounts`). Constituent schools has no top-level route (`/org`
 * only hosts sub-pages), so it is intentionally omitted here.
 */
const QUICK_LAUNCH: QuickLaunch[] = [
  { id: "roles", href: "/admin?tab=roles", title: "Manage Roles", desc: "Role definitions & permissions matrix", icon: KeyRound },
  { id: "officers", href: "/admin?tab=officers", title: "Manage Officers", desc: "Create & assign university officers", icon: UserPlus },
  { id: "audit", href: "/audit", title: "Audit Log", desc: "Trace administrative actions", icon: FileText },
  { id: "delegates", href: "/accounts", title: "Delegated Accounts", desc: "Consolidate delegated logins", icon: Users },
];

/**
 * Main ERP modules with a top-level route. Verified against `src/app/` —
 * only `/students` has a page at its root. `/admissions`, `/fees`, `/exams`,
 * `/attendance` and `/hr` only exist as sub-routes (no root page), so they are
 * omitted to avoid dead links.
 */
const MODULES: QuickLaunch[] = [
  { id: "students", href: "/students", title: "Students", desc: "Student lifecycle & records", icon: GraduationCap },
];

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  activeSchoolId = "ALL",
  activeSection = "overview",
}) => {
  // Track the active section so AdminShell/command-palette switching can target
  // an obvious default (overview) and highlight the matching quick-launch card.
  const [activeKey, setActiveKey] = useState<string>(activeSection || "overview");

  useEffect(() => {
    if (activeSection) {
      setActiveKey(activeSection);
    }
  }, [activeSection]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* University Administration Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-indigo-950 text-white flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck className="h-8 w-8 text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                University Administration
              </h1>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Platform Console
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              Super-admin oversight of roles, officers, delegated accounts and
              audit trails across the university — with quick access to every ERP
              module the platform unlocks.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Launch */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Quick Actions
          </h3>
          <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
            Admin
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_LAUNCH.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`group bg-white rounded-2xl border p-5 transition-all duration-200 shadow-xs flex flex-col gap-3 ${
                  isActive
                    ? "border-indigo-300 ring-2 ring-indigo-200"
                    : "border-slate-200/90 hover:border-indigo-200 hover:shadow"
                }`}
              >
                <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Modules */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Modules
          </h3>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            Cross-platform
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group bg-white rounded-2xl border border-slate-200/90 p-5 transition-all duration-200 shadow-xs flex flex-col gap-3 hover:border-indigo-200 hover:shadow"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
