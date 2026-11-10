"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, SearchItem, SearchResultGroup } from "@/lib/cross";
import { UserRole } from "@/types";
import { resolveEffectivePermissions, hasEffectivePermission } from "@/lib/perms";
import { buildCommandIndex, commandVisible, UxCommandGroup } from "@/lib/ux-core";
import { useUniversity } from "@/context/UniversityContext";
import {
  Search,
  X,
  Users,
  CreditCard,
  GraduationCap,
  Award,
  ArrowRight,
  BookOpen,
  Building2,
  FileText,
  Calendar,
  ClipboardList,
  Loader2,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: UserRole) => void;
}

type GroupKey = keyof SearchResultGroup;

const GROUP_META: Record<GroupKey, { label: string; icon: React.ElementType; primary?: boolean }> = {
  students: { label: "Students", icon: Users, primary: true },
  staff: { label: "Staff", icon: Building2 },
  applications: { label: "Applications", icon: FileText },
  programs: { label: "Programs", icon: GraduationCap },
  courses: { label: "Courses", icon: BookOpen },
  alumni: { label: "Alumni", icon: Award },
  events: { label: "Events", icon: Calendar },
  exams: { label: "Exams", icon: ClipboardList },
};

const GROUP_ORDER: GroupKey[] = [
  "students",
  "staff",
  "applications",
  "programs",
  "courses",
  "alumni",
  "events",
  "exams",
];

type Selectable =
  | { kind: "portal"; key: string; label: string; desc: string; act: () => void }
  | { kind: "command"; key: string; label: string; href: string; groupLabel: string };

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectRole,
}) => {
  const router = useRouter();
  const { currentUser } = useUniversity();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultGroup | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Effective permission set for gating commands (reuses the server role matrix).
  const effective = useMemo(
    () => resolveEffectivePermissions({ role: currentUser?.role }),
    [currentUser?.role],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Live server search, debounced. Keeps entity search (students/staff/courses).
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await globalSearch(trimmed);
        setResults(res.results);
        setError(null);
      } catch {
        setResults(null);
        setError("Search failed. Please try again.");
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults(null);
      setError(null);
      setSearching(false);
      setActiveIndex(0);
    }
  }, [isOpen]);

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  const match = (text: string) => !q || text.toLowerCase().includes(q);

  const roleActions: { label: string; role: UserRole; icon: React.ElementType; desc: string }[] = [
    { label: "Faculty / Teacher Workspace", role: "FACULTY", icon: Users, desc: "Timetable, period-wise attendance & CIA 30 marks entry" },
    { label: "Finance & Accounts Desk", role: "FINANCE_OFFICER", icon: CreditCard, desc: "Cash counter, student fee search & 3-part bank challans" },
    { label: "Controller of Examinations (COE)", role: "EXAM_CONTROLLER", icon: GraduationCap, desc: "Tabulation register, UGC 10-point scale & marksheet lock" },
    { label: "Director SST Secretariat", role: "DEAN", icon: Building2, desc: "School of Science & Technology, medical condonation & CBCS" },
    { label: "Student Self-Service Portal", role: "STUDENT", icon: BookOpen, desc: "71.4% attendance gauge, UPI fee payment & semester grade cards" },
    { label: "Registrar / Central Admin", role: "REGISTRAR_ADMIN", icon: Award, desc: "Admissions counseling funnel, university masters & NAAC A+" },
  ];

  // Data-driven command index, permission-filtered and query-filtered.
  const commandGroups: UxCommandGroup[] = useMemo(() => {
    const qLower = query.trim().toLowerCase();
    const matchText = (text: string) =>
      !qLower || text.toLowerCase().includes(qLower);
    const index = buildCommandIndex();
    return index
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            commandVisible(item, effective, hasEffectivePermission) &&
            (matchText(item.label) || matchText(item.href)),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [effective, query]);

  const showPortals = trimmed.length < 2;
  const filteredRoles = showPortals
    ? roleActions
    : roleActions.filter(
      (n) => match(n.label) || match(n.desc),
    );

  // Flatten portals + visible commands into one selectable list for arrow-key nav.
  const selectables: Selectable[] = useMemo(() => {
    const list: Selectable[] = [];
    filteredRoles.forEach((action) => {
      list.push({
        kind: "portal",
        key: `portal:${action.role}`,
        label: action.label,
        desc: action.desc,
        act: () => {
          onSelectRole(action.role);
          onClose();
        },
      });
    });
    commandGroups.forEach((group) => {
      group.items.forEach((item) => {
        list.push({
          kind: "command",
          key: `cmd:${group.key}:${item.href}`,
          label: item.label,
          href: item.href,
          groupLabel: group.label,
        });
      });
    });
    return list;
  }, [filteredRoles, commandGroups, onClose, onSelectRole]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  const groupCount = results
    ? GROUP_ORDER.reduce((acc, key) => acc + results[key].length, 0)
    : 0;

  const navigate = (href: string | null) => {
    if (href) {
      router.push(href);
    }
    onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (selectables.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % selectables.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + selectables.length) % selectables.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = selectables[Math.min(activeIndex, selectables.length - 1)];
      if (sel.kind === "portal") sel.act();
      else navigate(sel.href);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-slate-200 flex items-center px-4 py-3 bg-slate-50">
          <Search className="h-5 w-5 text-indigo-600 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search a module, page, student, staff, course, or officer role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent border-0 text-slate-800 placeholder-slate-400 text-sm focus:outline-hidden"
          />
          {searching ? (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin shrink-0" />
          ) : (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-5">
          {/* Portals (always offered, filtered by query) */}
          {filteredRoles.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                University Portals ({filteredRoles.length})
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {filteredRoles.map((action) => {
                  const Icon = action.icon;
                  const idx = selectables.findIndex((s) => s.kind === "portal" && s.key === `portal:${action.role}`);
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={action.role}
                      onClick={() => {
                        onSelectRole(action.role);
                        onClose();
                      }}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer",
                        active
                          ? "bg-indigo-50 border-indigo-200"
                          : "hover:bg-slate-50 border-transparent hover:border-slate-200",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold text-slate-800">{action.label}</p>
                          <p className="text-[11px] text-slate-500 truncate">{action.desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data-driven command index (Navigate) */}
          {commandGroups.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" /> Navigate
              </p>
              <div className="space-y-4">
                {commandGroups.map((group) => (
                  <div key={group.key}>
                    <p className="text-[11px] font-bold text-slate-500 mb-1.5">{group.label}</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {group.items.map((item) => {
                        const idx = selectables.findIndex(
                          (s) => s.kind === "command" && s.key === `cmd:${group.key}:${item.href}`,
                        );
                        const active = idx === activeIndex;
                        return (
                          <button
                            key={`${group.key}:${item.href}`}
                            onClick={() => navigate(item.href)}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer",
                              active
                                ? "bg-indigo-50 border-indigo-200"
                                : "hover:bg-slate-50 border-transparent hover:border-slate-200",
                            )}
                          >
                            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                              {item.label}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 shrink-0">
                              Open
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Server search: searching */}
          {!showPortals && searching && (
            <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-xs">Searching the university…</p>
            </div>
          )}

          {/* Server search: error */}
          {!showPortals && !searching && error && (
            <div className="py-10 text-center text-xs text-rose-600">{error}</div>
          )}

          {/* Server search: empty */}
          {!showPortals && !searching && !error && results && groupCount === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">No entity results for “{trimmed}”</p>
              <p className="text-xs text-slate-400 mt-1">
                Try a student name, roll number, staff ID, or course code.
              </p>
            </div>
          )}

          {/* Server search: results */}
          {!showPortals &&
            !searching &&
            !error &&
            results &&
            groupCount > 0 &&
            GROUP_ORDER.map((key) => {
              const items: SearchItem[] = results[key];
              if (items.length === 0) return null;
              const meta = GROUP_META[key];
              const Icon = meta.icon;
              return (
                <div key={key}>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {meta.label} ({items.length})
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {items.map((item) => (
                      <button
                        key={`${key}:${item.id}`}
                        onClick={() => navigate(item.href)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-slate-300 group transition-all text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-colors",
                              meta.primary && "bg-slate-900 text-white",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                            {item.label}
                          </span>
                        </div>
                        {item.href && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 group-hover:underline shrink-0">
                            Open
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

          {/* Nothing at all matches */}
          {selectables.length === 0 && !searching && !error && !results && (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">No matches for “{trimmed}”</p>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[10px] shadow-2xs">
              ESC
            </kbd>
            <span>to close</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[10px] shadow-2xs">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[10px] shadow-2xs">
                Ctrl + K
              </kbd>
              Universal Search
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
