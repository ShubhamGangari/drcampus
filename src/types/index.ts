// ==============================================================================
// Drivion CampusERP SaaS — TypeScript Type Definitions
// Tailored for Indian Private Universities (Multi-School, Multi-Tenant)
// ==============================================================================

export type UserRole =
  | "FACULTY"
  | "FINANCE_OFFICER"
  | "EXAM_CONTROLLER"
  | "DEAN"
  | "STUDENT"
  | "REGISTRAR_ADMIN"
  | "SUPER_ADMIN"
  | "PARENT";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation: string;
  department: string;
  schoolId: string; // e.g. "sch_eng" (SST), "sch_med" (HIMS), or "ALL" (Central)
  schoolCode: string;
  isCentral: boolean; // Central University Officers (Registrar, FO, COE) have multi-school oversight
  avatarInitials: string;
  permissions: string[];
}

export interface DemoCredential {
  role: UserRole;
  name: string;
  designation: string;
  department: string;
  email: string;
  password: string;
  schoolId: string;
  schoolCode: string;
  isCentral: boolean;
  avatarInitials: string;
  badge: string;
  description: string;
  permissions: string[];
}

export interface ConstituentSchool {
  id: string;
  name: string;
  code: string; // e.g. HIMS (Medical), SST (Engineering & Tech), SMS (Management), SBS (Bio-Sciences), HCN (Nursing), SPS (Pharmacy)
  deanName: string;
  establishedYear: number;
  programsCount: number;
}

export interface Program {
  id: string;
  schoolId: string;
  name: string;
  code: string; // e.g. BTECH-CSE, MBBS, MBA, BCA
  durationYears: number;
  totalSemesters: number;
  degreeType: "UG" | "PG" | "Doctoral" | "Diploma";
  currentIntake: number;
}

export interface Course {
  id: string;
  programId: string;
  semester: number;
  code: string; // e.g. CS401
  title: string;
  credits: number;
  theoryHours: number;
  practicalHours: number;
  maxInternalMarks: number; // CIA (e.g. 30 or 40)
  maxExternalMarks: number; // ESE (e.g. 70 or 60)
}

export interface Student {
  id: string;
  enrollmentNo: string; // e.g. SRHU20240145
  rollNo: string;
  fullName: string;
  avatar: string;
  gender: "Male" | "Female" | "Other";
  category: "General" | "OBC" | "SC" | "ST" | "EWS";
  quota: "State Quota (Uttarakhand)" | "All India / Management" | "NRI";
  schoolId: string;
  programId: string;
  currentSemester: number;
  batch: string; // e.g. 2024-2028
  email: string;
  mobile: string;
  parentName: string;
  parentMobile: string;
  attendancePercentage: number;
  attendanceShortage: boolean; // true if < 75%
  hostelResident: boolean;
  hostelDetails?: {
    block: string;
    roomNo: string;
    type: "AC Double" | "Non-AC Double" | "Single";
  };
  totalFeePayable: number;
  totalFeePaid: number;
  feeDues: number;
  academicPerformance: {
    cgpa: number;
    backlogs: number;
  };
}

export interface AdmissionApplication {
  id: string;
  applicationNo: string;
  candidateName: string;
  email: string;
  mobile: string;
  programApplied: string;
  schoolId: string;
  qualifyingExamScore: number; // 12th % or NEET / JEE Rank
  category: "General" | "OBC" | "SC" | "ST" | "EWS";
  status: "APPLIED" | "DOCUMENT_VERIFIED" | "MERIT_LISTED" | "SEAT_FROZEN" | "ENROLLED";
  tokenFeePaid: boolean;
  appliedDate: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  courseId: string;
  date: string;
  period: number;
  status: "PRESENT" | "ABSENT" | "ON_DUTY" | "MEDICAL_LEAVE";
}

export interface FeeHead {
  name: string;
  amount: number;
  isMandatory: boolean;
}

export interface FeeReceipt {
  receiptNo: string;
  studentEnrollment: string;
  studentName: string;
  program: string;
  semester: number;
  transactionDate: string;
  paymentMode: "UPI" | "Net Banking" | "Credit Card" | "NEFT/RTGS";
  transactionId: string;
  breakdown: FeeHead[];
  totalAmount: number;
  status: "SUCCESS" | "PENDING" | "FAILED";
}

export interface ExamMarkEntry {
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  internalMarks: number; // max 30
  externalMarks: number; // max 70
  totalMarks: number;    // max 100
  gradePoint: number;    // 10-point scale
  letterGrade: "O" | "A+" | "A" | "B+" | "B" | "C" | "F";
}

export interface CampusTelemetry {
  activeRfidPunchesToday: number;
  occupancyRatePercentage: number;
  todayFeesCollected: number;
  totalStudentsEnrolled: number;
  shortageCount: number;
  debarredCount: number;
  whatsappDeliveredToday: number;
}

export interface WhatsAppMessage {
  id: string;
  studentId: string;
  studentName: string;
  parentName: string;
  parentMobile: string;
  type: "SHORTAGE_ALERT" | "FEE_REMINDER" | "EXAM_MARKSHEET" | "GENERAL_NOTICE";
  attendancePct?: number;
  messageText: string;
  timestamp: string;
  status: "SENT" | "DELIVERED" | "READ";
}

export interface UniversityEvent {
  id: string;
  title: string;
  date: string;
  type: "EXAM" | "ADMISSION" | "ACADEMIC" | "FEES";
  schoolId: string;
  priority: "HIGH" | "MEDIUM" | "NORMAL";
}

export interface NaacMetric {
  criterionId: number;
  criterionTitle: string;
  weightage: number;
  currentScore: number;
  maxScore: number;
  status: "COMPLIANT" | "NEEDS_ATTENTION" | "IN_PROGRESS";
  keyIndicator: string;
  lastUpdated: string;
}

export interface MedicalAppeal {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  schoolId: string; // "sch_eng" (SST) or "sch_med" (HIMS)
  currentPct: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  date: string;
  hospitalDoc: string;
}



