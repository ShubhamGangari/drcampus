"use client";

import React, { useState } from "react";
import { DEMO_CREDENTIALS } from "@/data/mockData";
import { useUniversity } from "@/context/UniversityContext";
import { UserRole, DemoCredential } from "@/types";
import {
  X,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Zap,
  Users,
  CreditCard,
  GraduationCap,
  Building2,
  BookOpen,
  Award,
  Stethoscope,
  Cpu,
  Landmark,
  UserRound
} from "lucide-react";

interface DemoCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_ICONS: Record<UserRole, React.ElementType> = {
  FACULTY: Users,
  FINANCE_OFFICER: CreditCard,
  EXAM_CONTROLLER: GraduationCap,
  DEAN: Building2,
  STUDENT: BookOpen,
  PARENT: UserRound,
  REGISTRAR_ADMIN: Award,
  SUPER_ADMIN: ShieldCheck,
};

export const DemoCredentialsModal: React.FC<DemoCredentialsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { loginAsCredential, currentUser, showToast } = useUniversity();
  const [activeGroup, setActiveGroup] = useState<"ALL" | "SST" | "HIMS" | "CENTRAL">("ALL");

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label}: ${text}`, "info");
  };

  const handleSwitch = async (cred: DemoCredential) => {
    // Authenticate through the real server login; only close the modal if the
    // server actually verified these credentials (no client-side fabrication).
    // The page's currentUser sync effect will apply the correct workspace role.
    const result = await loginAsCredential(cred);
    if (result.user) {
      onClose();
    }
  };

  const filteredCredentials = DEMO_CREDENTIALS.filter((cred) => {
    if (activeGroup === "ALL") return true;
    if (activeGroup === "SST") return cred.schoolCode === "SST";
    if (activeGroup === "HIMS") return cred.schoolCode === "HIMS";
    if (activeGroup === "CENTRAL") return cred.isCentral;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">SRHU Constituent Multi-School Personas</h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="inline h-3 w-3 mr-0.5" /> Strict Tenant Isolation
                </span>
              </div>
              <p className="text-xs text-slate-500">
                SST officers are locked to SST; HIMS officers are locked to HIMS. Central officers (Registrar, FO, COE) have multi-school oversight.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close credentials modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* School Category Switcher Filter */}
        <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-100/60 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          <span className="text-slate-400 uppercase tracking-wider text-[10px] mr-1">Filter Jurisdiction:</span>
          <button
            onClick={() => setActiveGroup("ALL")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${activeGroup === "ALL" ? "bg-slate-900 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-200"
              }`}
          >
            All Personas ({DEMO_CREDENTIALS.length})
          </button>
          <button
            onClick={() => setActiveGroup("SST")}
            className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${activeGroup === "SST" ? "bg-indigo-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-200"
              }`}
          >
            <Cpu className="h-3 w-3" />
            <span>SST Engineering (3)</span>
          </button>
          <button
            onClick={() => setActiveGroup("HIMS")}
            className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${activeGroup === "HIMS" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-200"
              }`}
          >
            <Stethoscope className="h-3 w-3" />
            <span>HIMS Medical MBBS (3)</span>
          </button>
          <button
            onClick={() => setActiveGroup("CENTRAL")}
            className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${activeGroup === "CENTRAL" ? "bg-amber-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-200"
              }`}
          >
            <Landmark className="h-3 w-3" />
            <span>Central University (3)</span>
          </button>
        </div>

        {/* Credentials Grid */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCredentials.map((cred) => {
              const Icon = ROLE_ICONS[cred.role];
              const isCurrent = currentUser?.email.toLowerCase() === cred.email.toLowerCase();

              return (
                <div
                  key={cred.email}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${isCurrent
                    ? "border-indigo-600 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-600/30"
                    : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
                    }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm border border-slate-200 shrink-0 relative">
                          {cred.avatarInitials}
                          <Icon className="h-3 w-3 text-indigo-600 absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-slate-200" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 truncate">{cred.name}</h4>
                          <p className="text-[11px] text-slate-500 truncate">{cred.designation}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 inline-block ${cred.schoolCode === "SST"
                            ? "bg-indigo-50 text-indigo-700"
                            : cred.schoolCode === "HIMS"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-800"
                            }`}>
                            {cred.isCentral ? "Central Oversight" : `Unit: ${cred.schoolCode}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {cred.description}
                    </p>

                    {/* Credentials Box */}
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Email:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-800 font-semibold truncate max-w-[140px]">{cred.email}</span>
                          <button
                            onClick={() => handleCopy(cred.email, "Email")}
                            className="text-slate-400 hover:text-indigo-600"
                            title="Copy email"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Password:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-800 font-semibold">{cred.password}</span>
                          <button
                            onClick={() => handleCopy(cred.password, "Password")}
                            className="text-slate-400 hover:text-indigo-600"
                            title="Copy password"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Action Button */}
                  <div className="mt-3">
                    <button
                      onClick={() => handleSwitch(cred)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${isCurrent
                        ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                        : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                        }`}
                    >
                      {isCurrent ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Active Session</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5 text-amber-400" />
                          <span>Login as {cred.badge} ⚡</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>SRHU Statute 8.2 • Multi-Constituent School Tenant Governance</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
