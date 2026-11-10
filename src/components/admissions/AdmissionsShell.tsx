"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  FilePenLine,
  ClipboardList,
  Trophy,
  Armchair,
  GraduationCap,
  ArrowLeft,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admissions/cycles", label: "Admission Cycles", icon: CalendarRange },
  { href: "/admissions/applications", label: "Applications", icon: ClipboardList },
  { href: "/admissions/merit-list", label: "Merit List", icon: Trophy },
  { href: "/admissions/seat-allocation", label: "Seat Allocation", icon: Armchair },
  { href: "/admissions/apply", label: "Apply (Public)", icon: FilePenLine },
];

export function AdmissionsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
                    <GraduationCap className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-black text-slate-900 tracking-tight truncate">
                    Admissions
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                  Swami Rama Himalayan University • Admission Lifecycle
                </p>
              </div>
            </div>
            <nav
              aria-label="Admissions sections"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${active
                        ? "bg-indigo-50/90 text-indigo-700 font-bold border border-indigo-200 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
                      }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-200">{children}</main>
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
