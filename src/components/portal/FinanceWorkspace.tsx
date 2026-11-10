"use client";

import React, { useState, useEffect } from "react";
import { Student, FeeReceipt } from "@/types";
import { useUniversity } from "@/context/UniversityContext";
import {
  Search,
  Printer,
  X,
  QrCode,
  CheckCircle2,
  CreditCard,
  FileText,
  AlertTriangle
} from "lucide-react";

interface FinanceWorkspaceProps {
  activeSchoolId?: string;
  activeSection?: string;
}

export const FinanceWorkspace: React.FC<FinanceWorkspaceProps> = ({
  activeSchoolId = "ALL",
  activeSection = "counter",
}) => {
  const { students, payments, settleFee, showToast } = useUniversity();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReceipt, setActiveReceipt] = useState<FeeReceipt | null>(null);
  const [showChallanModal, setShowChallanModal] = useState<boolean>(false);
  const [challanStudent, setChallanStudent] = useState<Student | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"counter" | "defaulters" | "receipts" | "breakdown">("counter");

  useEffect(() => {
    if (activeSection === "defaulters") {
      setActiveTab("defaulters");
    } else if (activeSection === "receipts") {
      setActiveTab("receipts");
    } else if (activeSection === "breakdown") {
      setActiveTab("breakdown");
    } else if (activeSection === "counter") {
      setActiveTab("counter");
    }
  }, [activeSection]);

  const schoolScopedStudents = activeSchoolId === "ALL"
    ? students
    : students.filter((s) => s.schoolId === activeSchoolId);

  const defaulters = schoolScopedStudents.filter((s) => s.feeDues > 0);
  const totalDuesOutstanding = defaulters.reduce((acc, curr) => acc + curr.feeDues, 0);

  const filteredStudents = schoolScopedStudents.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.enrollmentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedStudents = activeTab === "defaulters"
    ? filteredStudents.filter((s) => s.feeDues > 0)
    : filteredStudents;

  const todayRealized = payments
    .filter((p) => {
      const d = new Date(p.createdAt);
      return d.toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA");
    })
    .reduce((acc, p) => acc + p.amount, 0);

  const handleSettleFee = async (student: Student) => {
    const receipt = await settleFee(student.id, student.feeDues);
    if (receipt) {
      setActiveReceipt(receipt);
      setToastMessage(`Payment of ₹${student.feeDues.toLocaleString("en-IN")} realized for ${student.fullName}. Receipt generated.`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleOpenChallan = (student: Student) => {
    setChallanStudent(student);
    setShowChallanModal(true);
  };

  const handleSendDefaulterNotice = (student: Student) => {
    showToast(`Statutory Dues Demand Notice dispatched to ${student.fullName} (${student.parentMobile}).`, "warning");
  };

  // Standard SRHU Multi-Head Fee Structure
  const feeHeads = [
    { head: "Tuition Fee (Annual)", sst: "₹ 1,10,000", hims: "₹ 6,50,000", sms: "₹ 95,000", sbs: "₹ 75,000", rule: "Semester wise in 2 installments" },
    { head: "Laboratory & Computing Facility Fee", sst: "₹ 20,000", hims: "₹ 80,000", sms: "₹ 15,000", sbs: "₹ 25,000", rule: "Per Annum" },
    { head: "Hostel Fee (AC Double with Food)", sst: "₹ 85,000", hims: "₹ 1,10,000", sms: "₹ 85,000", sbs: "₹ 85,000", rule: "Optional resident charges" },
    { head: "Examination & University Evaluation Fee", sst: "₹ 10,000", hims: "₹ 25,000", sms: "₹ 10,000", sbs: "₹ 10,000", rule: "Even Semester 2026" },
    { head: "One-Time Refundable Caution Deposit", sst: "₹ 10,000", hims: "₹ 25,000", sms: "₹ 10,000", sbs: "₹ 10,000", rule: "At the time of admission" },
    { head: "Uttarakhand Domicile Rebate (Statutory)", sst: "-26%", hims: "-26% (State Quota)", sms: "-26%", sbs: "-26%", rule: "Permanent Resident Certificate mandatory" },
  ];

  return (
    <div className="space-y-5">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="ml-3 text-white/80 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Clean Modern Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Finance &amp; Accounts Cash Counter
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              CA Avnish Shalya (FO)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time fee collection, installment reconciliation, 3-part bank challans &amp; digital receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Today Realized</span>
            <span className="font-extrabold text-emerald-600 text-sm">₹{todayRealized.toLocaleString("en-IN")}</span>
          </div>
          <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Outstanding Dues</span>
            <span className="font-extrabold text-rose-600 text-sm">₹{totalDuesOutstanding.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Finance Container with Segmented Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 px-6 pt-4 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("counter")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "counter"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <Search className="h-4 w-4" />
              Fee Collection Counter
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("defaulters")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "defaulters"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Defaulters Ledger ({defaulters.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("receipts")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "receipts"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              3-Part Bank Challan Generator
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("breakdown")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === "breakdown"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" />
              Fee Heads Schedule
            </span>
          </button>
        </div>

        {/* TAB 1: COUNTER & TAB 2: DEFAULTERS */}
        {(activeTab === "counter" || activeTab === "defaulters") && (
          <div>
            {/* Table Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search student, enrollment, or roll no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Showing {displayedStudents.length} students {activeTab === "defaulters" && "(Defaulters Filter Active)"}
                </span>
              </div>
            </div>

            {/* Student Fee Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Student &amp; Roll No</th>
                    <th className="px-4 py-3">Constituent School</th>
                    <th className="px-4 py-3">Total Payable</th>
                    <th className="px-4 py-3">Amount Paid</th>
                    <th className="px-4 py-3">Outstanding Dues</th>
                    <th className="px-4 py-3 text-right">Fee Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{st.fullName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {st.enrollmentNo} • {st.rollNo}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {st.schoolId === "sch_eng"
                          ? "SST"
                          : st.schoolId === "sch_med"
                            ? "HIMS"
                            : st.schoolId === "sch_mgmt"
                              ? "SMS"
                              : "SBS"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        ₹{st.totalFeePayable.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-emerald-700 font-semibold">
                        ₹{st.totalFeePaid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {st.feeDues > 0 ? (
                          <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            ₹{st.feeDues.toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Full Paid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {st.feeDues > 0 ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSettleFee(st)}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                              >
                                Settle Dues
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenChallan(st)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 cursor-pointer"
                                title="Generate 3-part bank challan"
                              >
                                Challan
                              </button>
                              {activeTab === "defaulters" && (
                                <button
                                  type="button"
                                  onClick={() => handleSendDefaulterNotice(st)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 cursor-pointer"
                                  title="Send statutory demand notice"
                                >
                                  Notice
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const recentPayment = [...payments]
                                  .filter((p) => p.studentId === st.id)
                                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                if (!recentPayment) return;
                                const receipt: FeeReceipt = {
                                  receiptNo: recentPayment.receiptNo,
                                  studentEnrollment: st.enrollmentNo,
                                  studentName: st.fullName,
                                  program: st.schoolId === "sch_med" ? "MBBS Medical" : "B.Tech Engineering",
                                  semester: st.currentSemester,
                                  transactionDate: new Date(recentPayment.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
                                  paymentMode: recentPayment.mode as FeeReceipt["paymentMode"],
                                  transactionId: recentPayment.transactionRef ?? `TXN-${recentPayment.id}`,
                                  breakdown: [
                                    { name: "Annual Tuition Fee", amount: recentPayment.amount * 0.8, isMandatory: true },
                                    { name: "Academic Facilities & Labs", amount: recentPayment.amount * 0.2, isMandatory: true },
                                  ],
                                  totalAmount: recentPayment.amount,
                                  status: "SUCCESS",
                                };
                                setActiveReceipt(receipt);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="h-3 w-3" />
                              View Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: 3-PART BANK CHALLAN GENERATOR */}
        {activeTab === "receipts" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  State Bank of India (SBI) 3-Part Bank Challan Generator
                </h3>
                <p className="text-xs text-slate-500">
                  Select a student below to generate an authorized SRHU SBI fee deposit challan (Student, Bank, University Copies).
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                SBI A/C: 3290001004812 (Jolly Grant Branch)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {schoolScopedStudents.map((st) => (
                <div key={st.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{st.fullName}</span>
                    <span className="font-mono text-[10px] text-slate-500">{st.rollNo}</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Constituent Unit:</span>
                      <strong>{st.schoolId === "sch_med" ? "HIMS (Medical)" : "SST (Technology)"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Dues:</span>
                      <strong className={st.feeDues > 0 ? "text-rose-600" : "text-emerald-700"}>
                        ₹{st.feeDues.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenChallan(st)}
                    className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Generate 3-Part Challan</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: FEE HEADS BREAKDOWN */}
        {activeTab === "breakdown" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Constituent Schools Multi-Head Fee Matrix (Academic Session 2026-2027)
                </h3>
                <p className="text-xs text-slate-500">
                  Approved by Board of Finance under Statute 14.1 of Swami Rama Himalayan University.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                Statutory Gazette
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Fee Head Particulars</th>
                    <th className="px-4 py-3">SST (Engineering)</th>
                    <th className="px-4 py-3">HIMS (MBBS)</th>
                    <th className="px-4 py-3">SMS (Management)</th>
                    <th className="px-4 py-3">SBS (Bio-Sciences)</th>
                    <th className="px-4 py-3">Billing Cycle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {feeHeads.map((head, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">{head.head}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{head.sst}</td>
                      <td className="px-4 py-3 font-bold text-indigo-700">{head.hims}</td>
                      <td className="px-4 py-3 text-slate-700">{head.sms}</td>
                      <td className="px-4 py-3 text-slate-700">{head.sbs}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{head.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* 3-Part Bank Challan Modal */}
      {showChallanModal && challanStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-300 shadow-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  State Bank of India • Official 3-Part University Challan
                </h3>
                <p className="text-xs text-slate-500">
                  Swami Rama Himalayan University • Collection A/C No: 3290001004812 (IFSC: SBIN0010580)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Challan
                </button>
                <button
                  type="button"
                  onClick={() => setShowChallanModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 3-Part Challan Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              {["1. Student Copy", "2. Bank Copy", "3. University Copy"].map((part, index) => (
                <div key={index} className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 space-y-2">
                  <div className="text-center border-b pb-2">
                    <span className="font-mono text-[10px] font-bold text-indigo-700 uppercase">{part}</span>
                    <h5 className="font-bold text-slate-900 text-xs mt-0.5">SRHU Jolly Grant</h5>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-slate-400">Challan No:</span><strong className="font-mono">CH-2026-{challanStudent.rollNo.slice(-3)}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Date:</span><span>02 Nov 2026</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Student:</span><strong className="truncate max-w-[110px]">{challanStudent.fullName}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Roll No:</span><span className="font-mono">{challanStudent.rollNo}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Unit:</span><strong>{challanStudent.schoolId === "sch_med" ? "HIMS" : "SST"}</strong></div>
                  </div>
                  <div className="border-t pt-2 space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-900">
                      <span>Total Amount:</span>
                      <span>₹{(challanStudent.feeDues > 0 ? challanStudent.feeDues : challanStudent.totalFeePayable).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="pt-4 text-center text-[10px] text-slate-400 border-t border-slate-200">
                    <span>Authorized Cashier Seal / Signature</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Realized Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-300 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Official Electronic Fee Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-400">Receipt Number:</span>
                <strong className="font-mono text-indigo-700">{activeReceipt.receiptNo}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <strong className="font-mono">{activeReceipt.transactionId}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Student Name:</span>
                <strong>{activeReceipt.studentName} ({activeReceipt.studentEnrollment})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Program &amp; Term:</span>
                <span>{activeReceipt.program} (Sem {activeReceipt.semester})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Mode:</span>
                <span className="font-semibold">{activeReceipt.paymentMode}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                <span>Amount Realized:</span>
                <span className="text-emerald-700">₹{activeReceipt.totalAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <QrCode className="h-8 w-8 text-slate-800" />
                <span className="text-[10px] text-slate-400 font-mono">VERIFIED • SRHU FINANCE</span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
