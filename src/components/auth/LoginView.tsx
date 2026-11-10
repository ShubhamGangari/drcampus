"use client";

import React, { useState } from "react";
import { DEMO_CREDENTIALS } from "@/data/mockData";
import { useUniversity } from "@/context/UniversityContext";
import { UserRole, DemoCredential } from "@/types";
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  Lock,
  Mail,
  Copy,
  Users,
  CreditCard,
  GraduationCap,
  Building2,
  BookOpen,
  Award,
  Sparkles,
  School,
  Stethoscope,
  Cpu,
  Landmark,
  AlertCircle,
  Check,
  UserRound
} from "lucide-react";

interface LoginViewProps {
  onSuccess: (role: UserRole) => void;
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

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const { login, showToast } = useUniversity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"SST" | "HIMS" | "CENTRAL" | "ALL">("SST");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter both your email and password.");
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.user) {
      onSuccess(result.user.role);
    } else {
      setError(result.error || "Invalid email or password");
    }
  };

  // Demo personas only pre-fill the form — authentication always goes through the API.
  const handleAutofill = (cred: DemoCredential) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setError(null);
    showToast(`Loaded credentials for ${cred.name} (${cred.badge}). Press Authenticate to sign in.`, "info");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    showToast(`Copied ${text}`, "info");
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const filteredCredentials = DEMO_CREDENTIALS.filter((cred) => {
    if (selectedCategory === "ALL") return true;
    if (selectedCategory === "SST") return cred.schoolCode === "SST";
    if (selectedCategory === "HIMS") return cred.schoolCode === "HIMS";
    if (selectedCategory === "CENTRAL") return cred.isCentral;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans antialiased text-slate-800 relative selection:bg-indigo-500 selection:text-white">

      {/* Top University Branding Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0 tracking-tight">
            SRHU
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                Swami Rama Himalayan University
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="h-3 w-3" />
                NAAC Grade A+ (3.42)
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              University Management System (UMS 2026) • Jolly Grant, Dehradun - 248016
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500 hidden md:block">
            SRHU Statute 8.2 Compliant
          </span>
          <button
            type="button"
            onClick={() => handleAutofill(DEMO_CREDENTIALS[4])} // Director SST
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            <span>Fill Director SST ⚡</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 flex-1">

        {/* Intro Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            Constituent Multi-School Institutional Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Single Sign-On &amp; Role-Based Workspace Access
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Every user is authenticated with strict institutional jurisdiction: Engineering (SST) officers are restricted to SST engineering portals, Medical (HIMS) officers are bound to Himalayan Hospital &amp; MBBS rotations, and Central statutory officers exercise cross-school university governance.
          </p>
        </div>

        {/* 2-Column Responsive Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Direct Manual Sign-In Card */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Officer Sign-In Form
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Enter your institutional credentials or choose a pre-filled persona on the right.
              </p>
            </div>

            <form onSubmit={handleManualLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Institutional Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@srhu.edu.in"
                    className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-xs focus:outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-semibold">
                    Account Password
                  </label>
                  <span className="text-[11px] text-indigo-600 font-medium">
                    (Default: Password@2026)
                  </span>
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-xs focus:outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Authenticate &amp; Enter Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium leading-relaxed"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </form>

            {/* Jurisdiction Security Notice */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Statute 8.2 Security Guard</span>
              </div>
              <p className="leading-relaxed text-slate-500">
                Your role determines which constituent school dataset you can inspect. SST credentials only open engineering data; HIMS credentials only open medical hospital data.
              </p>
            </div>
          </div>

          {/* Right Column: Persona Autofill Grid (pre-fills the form; auth via API) */}
          <div className="lg:col-span-8 space-y-4">

            {/* Category Segmented Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <School className="h-4 w-4 text-indigo-600" />
                  <span>Verified Persona Autofill</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Select a persona to pre-fill the sign-in form — then press Authenticate.
                </p>
              </div>

              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                ⚡ Autofill · Submit via API
              </span>
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedCategory("SST")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${selectedCategory === "SST"
                  ? "bg-white text-indigo-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
              >
                <Cpu className="h-3.5 w-3.5 text-indigo-600" />
                <span>🏛️ SST Engineering (3)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("HIMS")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${selectedCategory === "HIMS"
                  ? "bg-white text-emerald-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
              >
                <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
                <span>🩺 HIMS Medical MBBS (3)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("CENTRAL")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${selectedCategory === "CENTRAL"
                  ? "bg-white text-purple-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
              >
                <Landmark className="h-3.5 w-3.5 text-purple-600" />
                <span>⚖️ Central University (3)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${selectedCategory === "ALL"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
              >
                All (9)
              </button>
            </div>

            {/* Persona Cards Grid (Spacious, No Cramped Inner Scrollbar) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCredentials.map((cred) => {
                const Icon = ROLE_ICONS[cred.role];
                const isCopied = copiedEmail === cred.email;

                return (
                  <div
                    key={cred.email}
                    className="bg-white hover:bg-slate-50/50 border border-slate-200/90 hover:border-indigo-400 rounded-2xl p-4 sm:p-5 transition-all shadow-xs hover:shadow-md group flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">

                      {/* Avatar and Info Header */}
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-900 group-hover:bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 transition-colors shadow-xs">
                          {cred.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">
                            {cred.name}
                          </h3>
                          <p className="text-xs text-slate-500 leading-tight truncate mt-0.5">
                            {cred.designation}
                          </p>
                        </div>
                      </div>

                      {/* Role & School Jurisdiction Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {cred.badge}
                        </span>
                        <span
                          className={`font-mono px-2 py-0.5 rounded-md border font-semibold ${cred.isCentral
                            ? "text-purple-700 bg-purple-50 border-purple-200"
                            : cred.schoolCode === "HIMS"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-blue-700 bg-blue-50 border-blue-200"
                            }`}
                        >
                          {cred.isCentral ? "🌐 All Schools" : `🔒 Unit: ${cred.schoolCode}`}
                        </span>
                      </div>

                      {/* Operational Scope Description */}
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {cred.description}
                      </p>

                      {/* Email & Helper Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono truncate max-w-[150px]">{cred.email}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAutofill(cred)}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                            title="Load credentials into login form"
                          >
                            Fill Form
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(cred.email)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Copy email address"
                          >
                            {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Autofill Action Button (authentication always goes through the API) */}
                    <button
                      type="button"
                      onClick={() => handleAutofill(cred)}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 group-hover:bg-indigo-600 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Icon className="h-3.5 w-3.5 text-indigo-300 group-hover:text-white" />
                      <span>Fill Sign-In Form</span>
                    </button>

                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </main>

      {/* University Official Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 sm:px-8 py-4 text-center text-xs text-slate-500">
        Swami Rama Himalayan University (SRHU), Swami Ram Nagar, Jolly Grant, Dehradun - 248016 | UGC 2(f) State Private University • NAAC Grade A+ (3.42) • NMC &amp; AICTE Approved
      </footer>

    </div>
  );
};
