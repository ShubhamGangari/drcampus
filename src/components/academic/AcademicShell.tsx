"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays, CalendarClock, CalendarRange, ShieldAlert } from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";

const NAV_ITEMS = [
  { href: "/academic/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/academic/timetable", label: "Timetable", icon: CalendarClock },
];

/** Staff+ roles may access the Academic Scheduling module. */
const PERMITTED_ROLES = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "FACULTY",
  "STUDENT",
];

export function AcademicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, initializing } = useUniversity();

  const permitted = !!currentUser?.role && PERMITTED_ROLES.includes(currentUser.role);

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

  if (!permitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans antialiased text-slate-800">
        <div className="max-w-sm w-full text-center rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-10">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
          </div>
          <h2 className="text-base font-black text-slate-900">No access to Academic Scheduling</h2>
          <p className="text-sm text-slate-500 mt-1.5">
            This module is available to staff roles and students.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans antialiased text-slate-800">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_16px_rgba(15,23,42,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/"
                className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 hover:bg-indigo-600 transition-colors shadow-2xs"
                aria-label="Back to portal"
                title="Return to Main University Portal"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                    <CalendarRange className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-black text-slate-900 tracking-tight">
                    Academic Scheduling
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  Calendar · timetable · class schedules
                </p>
              </div>
            </div>
          </div>
          <nav
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
            aria-label="Academic navigation"
          >
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${active
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
                    }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
