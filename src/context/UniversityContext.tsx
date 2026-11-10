"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { STUDENTS_DATA, DEMO_CREDENTIALS } from "@/data/mockData";
import { Student, FeeReceipt, AuthUser, UserRole, DemoCredential, MedicalAppeal } from "@/types";
import { fetchStudents, type StudentSummary } from "@/lib/students";
import {
  fetchDues,
  fetchInvoices,
  fetchPayments,
  createPayment,
  type DueRecord,
  type PaymentRecord,
} from "@/lib/fees";
import { markAttendance as apiMarkAttendance } from "@/lib/attendance";

interface UniversityContextType {
  currentUser: AuthUser | null;
  initializing: boolean;
  students: Student[];
  dues: DueRecord[];
  payments: PaymentRecord[];
  appeals: MedicalAppeal[];
  attendanceMap: Record<string, "P" | "A" | "OD">;
  feeReceipts: FeeReceipt[];
  gazetteLocked: boolean;
  ciaSubmitted: boolean;
  toast: { message: string; type: "success" | "info" | "warning" } | null;
  login: (email: string, password?: string) => Promise<{ user: AuthUser | null; error?: string }>;
  loginAsCredential: (cred: DemoCredential) => Promise<{ user: AuthUser | null; error?: string }>;
  loginAsRole: (role: UserRole, schoolCode?: string) => Promise<{ user: AuthUser | null; error?: string }>;
  logout: () => Promise<void>;
  settleFee: (studentId: string, amount?: number, paymentMode?: "UPI" | "Net Banking" | "Credit Card" | "NEFT/RTGS") => Promise<FeeReceipt | null>;
  actionAppeal: (appealId: string, action: "APPROVED" | "REJECTED") => void;
  markAttendance: (
    studentId: string,
    status: "P" | "A" | "OD",
    options: { courseId: string; date?: string }
  ) => Promise<boolean>;
  markAllAttendance: (
    status: "P" | "A",
    options: { courseId: string; date?: string }
  ) => Promise<boolean>;
  submitCiaMarks: (courseCode: string) => void;
  lockGazette: () => void;
  showToast: (message: string, type?: "success" | "info" | "warning") => void;
  clearToast: () => void;
}

/**
 * Enrich the lean API user object (id, name, email, role, schoolId) into the full
 * AuthUser used by the UI. Extra display fields (designation, department, schoolCode,
 * isCentral, avatarInitials, permissions) are resolved from the known demo personas
 * by email, falling back to deterministic derivation from schoolId.
 */
function buildAuthUser(apiUser: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId: string;
}): AuthUser {
  const cred =
    DEMO_CREDENTIALS.find((c) => c.email.toLowerCase() === apiUser.email.toLowerCase()) ||
    DEMO_CREDENTIALS.find((c) => c.role === apiUser.role && c.schoolId === apiUser.schoolId);

  const schoolCode =
    cred?.schoolCode ??
    (apiUser.schoolId === "ALL"
      ? "SRHU"
      : apiUser.schoolId === "sch_med"
        ? "HIMS"
        : "SST");
  const isCentral = cred?.isCentral ?? apiUser.schoolId === "ALL";
  const initials =
    cred?.avatarInitials ??
    apiUser.name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role,
    designation: cred?.designation ?? "University Officer",
    department: cred?.department ?? "University",
    schoolId: apiUser.schoolId,
    schoolCode,
    isCentral,
    avatarInitials: initials,
    permissions: cred?.permissions ?? [],
  };
}

const PROGRAM_SCHOOL: Record<string, string> = {
  prog_btech_cse: "sch_eng",
  prog_btech_aiml: "sch_eng",
  prog_bca: "sch_eng",
  prog_mbbs: "sch_med",
};

function toRichStudent(summary: StudentSummary): Student {
  const mock = STUDENTS_DATA.find((m) => m.email.toLowerCase() === summary.email.toLowerCase());
  const schoolId = mock?.schoolId ?? PROGRAM_SCHOOL[summary.programId] ?? "sch_eng";
  const fullName = `${summary.firstName} ${summary.lastName}`.trim();
  return {
    id: summary.id,
    enrollmentNo: mock?.enrollmentNo ?? summary.rollNo,
    rollNo: summary.rollNo,
    fullName,
    avatar: mock?.avatar ?? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
    gender: mock?.gender ?? "Male",
    category: mock?.category ?? "General",
    quota: mock?.quota ?? "All India / Management",
    schoolId,
    programId: summary.programId,
    currentSemester: mock?.currentSemester ?? 1,
    batch: mock?.batch ?? summary.batchId ?? "",
    email: summary.email,
    mobile: mock?.mobile ?? "",
    parentName: mock?.parentName ?? "",
    parentMobile: mock?.parentMobile ?? "",
    attendancePercentage: mock?.attendancePercentage ?? 0,
    attendanceShortage: mock?.attendanceShortage ?? false,
    hostelResident: mock?.hostelResident ?? false,
    hostelDetails: mock?.hostelDetails,
    totalFeePayable: mock?.totalFeePayable ?? 0,
    totalFeePaid: mock?.totalFeePaid ?? 0,
    feeDues: mock?.feeDues ?? 0,
    academicPerformance: mock?.academicPerformance ?? { cgpa: 0, backlogs: 0 },
  };
}

const UniversityContext = createContext<UniversityContextType | undefined>(undefined);

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const UniversityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Start unauthenticated; hydrate from the real /me endpoint on mount.
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  const [students, setStudents] = useState<Student[]>(STUDENTS_DATA);
  const [dues, setDues] = useState<DueRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [appeals, setAppeals] = useState<MedicalAppeal[]>([
    {
      id: "app_1",
      studentId: "stu_1",
      studentName: "Aarav Sharma",
      rollNo: "24BTECH014",
      schoolId: "sch_eng",
      currentPct: 72.4,
      reason: "Himalayan Hospital (HIMS) admission for Dengue fever (7 days certified in-patient leave attached).",
      status: "PENDING",
      date: "28-Feb-2026",
      hospitalDoc: "HIMS-MED-CERT-88421.pdf",
    },
    {
      id: "app_2",
      studentId: "stu_7",
      studentName: "Sneha Semwal",
      rollNo: "24MBBS084",
      schoolId: "sch_med",
      currentPct: 78.4,
      reason: "In-patient isolation & needle exposure prophylaxis at 1,200-bed Himalayan Hospital Clinical Wards (10 days).",
      status: "PENDING",
      date: "01-Mar-2026",
      hospitalDoc: "HIMS-CLIN-ROT-99124.pdf",
    },
    {
      id: "app_3",
      studentId: "stu_4",
      studentName: "Ananya Negi",
      rollNo: "24MBA019",
      schoolId: "sch_mgmt",
      currentPct: 71.0,
      reason: "Represented SRHU at All India Inter-University Management Hackathon, New Delhi (OD certified).",
      status: "PENDING",
      date: "02-Mar-2026",
      hospitalDoc: "SMS-DEAN-OD-042.pdf",
    },
  ]);

  const [attendanceMap, setAttendanceMap] = useState<Record<string, "P" | "A" | "OD">>({
    stu_1: "P",
    stu_2: "P",
    stu_3: "A",
    stu_4: "P",
    stu_5: "P",
    stu_6: "P",
    stu_7: "P",
  });

  const [feeReceipts, setFeeReceipts] = useState<FeeReceipt[]>([]);
  const [gazetteLocked, setGazetteLocked] = useState<boolean>(false);
  const [ciaSubmitted, setCiaSubmitted] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "warning" } | null>(null);

  // Live data feeds — hydrate students / dues / payments from the real APIs so
  // the portal workspaces render genuine records instead of client-side mocks.
  const refreshFeeds = async (): Promise<boolean> => {
    try {
      const [realStudents, duesList, paymentsList] = await Promise.all([
        fetchStudents(),
        fetchDues(),
        fetchPayments(),
      ]);
      const duesMap = new Map<string, number>(duesList.map((d) => [d.studentId, d.totalDue]));
      setStudents(
        realStudents.map((s) => {
          const rich = toRichStudent(s);
          const due = duesMap.get(s.id);
          return { ...rich, feeDues: due ?? 0, totalFeePayable: rich.totalFeePayable || due || 0 };
        })
      );
      setDues(duesList);
      setPayments(paymentsList);
      return true;
    } catch {
      return false;
    }
  };

  // Hydrate session from the real GET /api/auth/me endpoint on first mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (active && data?.user) {
            setCurrentUser(buildAuthUser(data.user));
            void refreshFeeds();
          }
        }
      } catch {
        // Network/not authenticated — leave currentUser as null.
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const showToast = (message: string, type: "success" | "info" | "warning" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const clearToast = () => setToast(null);

  // Authentication & RBAC Actions — real API-backed login.
  const login = async (
    email: string,
    password?: string
  ): Promise<{ user: AuthUser | null; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message = data?.error?.message || "Invalid email or password";
        showToast(message, "warning");
        return { user: null, error: message };
      }

      const apiUser = data?.user;
      if (!apiUser) {
        const message = "Invalid email or password";
        showToast(message, "warning");
        return { user: null, error: message };
      }

      const user = buildAuthUser(apiUser);
      setCurrentUser(user);
      void refreshFeeds();
      showToast(`Welcome back, ${user.name}. Session authenticated.`, "success");
      return { user };
    } catch {
      const message = "Unable to connect to the server. Please try again.";
      showToast(message, "warning");
      return { user: null, error: message };
    }
  };

  // Persona switching is NOT a local impersonation — every role/credential
  // switch goes through the real `POST /api/auth/login` flow so a session is
  // only ever established when the server verifies the credentials. No user is
  // ever fabricated client-side. If the persona credentials fail server-side,
  // no authenticated session is set and `login` surfaces the error toast.
  const loginAsCredential = async (
    cred: DemoCredential
  ): Promise<{ user: AuthUser | null; error?: string }> => {
    return login(cred.email, cred.password);
  };

  const loginAsRole = async (
    role: UserRole,
    schoolCode?: string
  ): Promise<{ user: AuthUser | null; error?: string }> => {
    const cred =
      DEMO_CREDENTIALS.find((c) => c.role === role && (!schoolCode || c.schoolCode === schoolCode)) ||
      DEMO_CREDENTIALS.find((c) => c.role === role) ||
      DEMO_CREDENTIALS[0];
    if (!cred) return { user: null };
    return login(cred.email, cred.password);
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort server session clear — still clear the local session below.
    }
    setCurrentUser(null);
    setDues([]);
    setPayments([]);
    showToast("You have been logged out of the University UMS.", "info");
  };

  // Real-Time Fee Settlement — persists through the real payments API against the
  // student's open invoice and returns a server-issued receipt.
  const settleFee = async (
    studentId: string,
    amount?: number,
    paymentMode: "UPI" | "Net Banking" | "Credit Card" | "NEFT/RTGS" = "UPI"
  ): Promise<FeeReceipt | null> => {
    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return null;

    const duesToClear = amount ?? targetStudent.feeDues;
    if (duesToClear <= 0) return null;

    try {
      const invoices = await fetchInvoices({ studentId });
      const openInvoice = invoices.find(
        (iv) =>
          (iv.status === "UNPAID" || iv.status === "PARTIAL") &&
          iv.amount - iv.paidAmount > 0
      );
      if (!openInvoice) {
        showToast(`No outstanding invoice on file for ${targetStudent.fullName}.`, "warning");
        return null;
      }
      const remaining = Math.max(0, openInvoice.amount - openInvoice.paidAmount);
      const payAmount = Math.min(duesToClear, remaining);

      const { receiptNo } = await createPayment({
        invoiceId: openInvoice.id,
        amount: payAmount,
        mode: paymentMode,
        transactionRef: `TXN-${Date.now()}`,
      });

      const newReceipt: FeeReceipt = {
        receiptNo,
        studentEnrollment: targetStudent.enrollmentNo,
        studentName: targetStudent.fullName,
        program: targetStudent.programId === "prog_btech_cse" ? "B.Tech CSE" : "B.Tech Program",
        semester: targetStudent.currentSemester,
        transactionDate: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        paymentMode,
        transactionId: `TXN-${Date.now()}`,
        breakdown: [
          { name: "Tuition Fee (Semester Balance)", amount: payAmount * 0.75, isMandatory: true },
          { name: "Laboratory & Computing Facility Fee", amount: payAmount * 0.25, isMandatory: true },
        ],
        totalAmount: payAmount,
        status: "SUCCESS",
      };

      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? {
              ...s,
              totalFeePaid: s.totalFeePaid + payAmount,
              feeDues: Math.max(0, s.feeDues - payAmount),
            }
            : s
        )
      );
      setFeeReceipts((prev) => [newReceipt, ...prev]);
      void refreshFeeds();
      showToast(`Payment of ₹${payAmount.toLocaleString("en-IN")} realized for ${targetStudent.fullName}. Receipt ${receiptNo} issued.`);
      return newReceipt;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment could not be processed.";
      showToast(message, "warning");
      return null;
    }
  };

  // Real-Time Condonation Action (Cross-Role sync to Student, Dean & Admit Card)
  const actionAppeal = (appealId: string, action: "APPROVED" | "REJECTED") => {
    const targetAppeal = appeals.find((a) => a.id === appealId);
    if (!targetAppeal) return;

    setAppeals((prev) =>
      prev.map((a) => (a.id === appealId ? { ...a, status: action } : a))
    );

    if (action === "APPROVED") {
      const isMed = targetAppeal.schoolId === "sch_med";
      const restoredPct = isMed ? 83.5 : 76.5;

      setStudents((prev) =>
        prev.map((s) =>
          s.id === targetAppeal.studentId
            ? {
              ...s,
              attendancePercentage: restoredPct,
              attendanceShortage: false,
            }
            : s
        )
      );

      if (isMed) {
        showToast(
          `Medical Condonation approved by Dean HIMS (Prof. Ahamadulla Shariff) for ${targetAppeal.studentName} on Himalayan Hospital certificate. Attendance restored to ${restoredPct}% (NMC Compliant).`
        );
      } else {
        showToast(
          `Medical Condonation approved by Director SST (Prof. Pramod Kumar) for ${targetAppeal.studentName}. Attendance restored to ${restoredPct}% (Eligible for Exam Hall Ticket).`
        );
      }
    } else {
      showToast(
        `Condonation appeal rejected for ${targetAppeal.studentName}. Debarment confirmed under statutory examination ordinances.`,
        "warning"
      );
    }
  };

  // Real-Time Faculty Attendance Marking (Dynamically updates student percentage and shortage)
  const markAttendance = async (
    studentId: string,
    status: "P" | "A" | "OD",
    options: { courseId: string; date?: string }
  ): Promise<boolean> => {
    // Optimistic local update so the roll-call grid feels instant.
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const delta = status === "A" ? -1.4 : status === "OD" ? 0.4 : 0.8;
        const newPct = parseFloat(Math.min(99.0, Math.max(40.0, s.attendancePercentage + delta)).toFixed(1));
        const isMed = s.schoolId === "sch_med";
        const isShortage = isMed ? newPct < 80.0 : newPct < 75.0;
        return {
          ...s,
          attendancePercentage: newPct,
          attendanceShortage: isShortage,
        };
      })
    );

    try {
      await apiMarkAttendance({
        courseId: options.courseId,
        date: options.date ?? todayIso(),
        records: [
          {
            studentId,
            status: status === "A" ? "ABSENT" : "PRESENT",
          },
        ],
      });
      showToast(
        `Attendance saved: ${status === "A" ? "Absent" : status === "OD" ? "On Duty (Present)" : "Present"} recorded for ${studentId}.`,
        "success"
      );
      return true;
    } catch {
      showToast("Could not save attendance. Please verify the course and try again.", "warning");
      return false;
    }
  };

  const markAllAttendance = async (
    status: "P" | "A",
    options: { courseId: string; date?: string }
  ): Promise<boolean> => {
    const updated: Record<string, "P" | "A" | "OD"> = {};
    students.forEach((s) => {
      updated[s.id] = status;
    });
    setAttendanceMap(updated);

    setStudents((prev) =>
      prev.map((s) => {
        const delta = status === "A" ? -2.2 : 1.2;
        const newPct = parseFloat(Math.min(99.0, Math.max(38.0, s.attendancePercentage + delta)).toFixed(1));
        const isMed = s.schoolId === "sch_med";
        return {
          ...s,
          attendancePercentage: newPct,
          attendanceShortage: isMed ? newPct < 80.0 : newPct < 75.0,
        };
      })
    );

    try {
      await apiMarkAttendance({
        courseId: options.courseId,
        date: options.date ?? todayIso(),
        records: students.map((s) => ({
          studentId: s.id,
          status: status === "A" ? "ABSENT" : "PRESENT",
        })),
      });
      showToast(`Marked all students as ${status === "P" ? "Present" : "Absent"}. Saved to the live attendance register.`, "success");
      return true;
    } catch {
      showToast("Could not bulk-save attendance. Please verify the course and try again.", "warning");
      return false;
    }
  };

  const submitCiaMarks = (courseCode: string) => {
    setCiaSubmitted(true);
    showToast(`Continuous Internal Assessment (CIA) marks for ${courseCode} submitted to Controller of Examinations (COE).`);
  };

  // Real-Time Result Gazette Lock
  const lockGazette = () => {
    setGazetteLocked(true);
    showToast("Official Result Gazette successfully locked and digitally signed by COE Prof. (Dr.) Archana Prakash. Results published to all student portals.");
  };

  return (
    <UniversityContext.Provider
      value={{
        currentUser,
        initializing,
        students,
        dues,
        payments,
        appeals,
        attendanceMap,
        feeReceipts,
        gazetteLocked,
        ciaSubmitted,
        toast,
        login,
        loginAsCredential,
        loginAsRole,
        logout,
        settleFee,
        actionAppeal,
        markAttendance,
        markAllAttendance,
        submitCiaMarks,
        lockGazette,
        showToast,
        clearToast,
      }}
    >
      {children}
    </UniversityContext.Provider>
  );
};

export const useUniversity = () => {
  const context = useContext(UniversityContext);
  if (!context) {
    throw new Error("useUniversity must be used within a UniversityProvider");
  }
  return context;
};
