"use client";

import React from "react";
import { X, Printer, ShieldCheck, QrCode, CheckCircle2, Ticket } from "lucide-react";
import type { HallTicket, ExamDetail } from "@/lib/exams";
import type { StudentSummary } from "@/lib/students";
import { fullName } from "@/lib/students";

interface HallTicketCardModalProps {
    open: boolean;
    ticket: HallTicket | null;
    exam: ExamDetail | null;
    student: StudentSummary | null;
    onClose: () => void;
}

export function HallTicketCardModal({
    open,
    ticket,
    exam,
    student,
    onClose,
}: HallTicketCardModalProps) {
    if (!open || !ticket) return null;

    const handlePrint = () => {
        window.print();
    };

    const studentFullName = student ? fullName(student) : "Candidate";

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:m-0 print:p-0">
                
                {/* Header Actions (Hidden in Print) */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-indigo-600" />
                        <span className="text-xs font-bold text-slate-800">Official Examination Hall Ticket</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition shadow-xs cursor-pointer"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print Admit Card</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Printable Admit Card Surface */}
                <div className="p-6 sm:p-8 space-y-6 text-slate-900 print:p-6" id="printable-admit-card">
                    {/* University Masthead */}
                    <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-xs font-mono font-bold tracking-widest uppercase bg-slate-900 text-white px-2.5 py-0.5 rounded">
                                SRHU CENTRAL CONTROLLER OF EXAMINATIONS
                            </span>
                        </div>
                        <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900">
                            Swami Rama Himalayan University
                        </h1>
                        <p className="text-xs font-semibold text-slate-600">
                            END SEMESTER REGULAR &amp; SUPPLEMENTARY THEORY EXAMINATIONS · SPRING 2026
                        </p>
                        <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                            OFFICIAL CANDIDATE E-ADMIT CARD &amp; ENTRY PASS
                        </p>
                    </div>

                    {/* Candidate Details & QR Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 print:bg-white print:border-slate-300">
                        <div className="sm:col-span-3 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Candidate Name
                                </span>
                                <span className="font-bold text-slate-900 text-sm">{studentFullName}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Hall Ticket Number
                                </span>
                                <span className="font-mono font-black text-indigo-700 text-sm">
                                    {ticket.hallTicketNo}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    University Roll No
                                </span>
                                <span className="font-bold text-slate-800">{student?.rollNo ?? "—"}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Program &amp; Branch
                                </span>
                                <span className="font-semibold text-slate-800">{exam?.programId?.toUpperCase() ?? "UG DEGREE"}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Examination Center
                                </span>
                                <span className="font-semibold text-slate-800">Academic Block III — Examination Hall</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Statutory Clearance
                                </span>
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 text-[11px]">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    <span>75% Attendance &amp; Dues Cleared</span>
                                </span>
                            </div>
                        </div>

                        {/* Security QR Box */}
                        <div className="sm:col-span-1 flex flex-col items-center justify-center p-3 rounded-xl bg-white border border-slate-200 print:border-slate-300">
                            <div className="h-20 w-20 bg-slate-900 rounded-lg flex items-center justify-center text-white font-mono text-[9px] p-2 text-center">
                                [SECURE QR: {ticket.hallTicketNo}]
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-400 mt-1 uppercase">
                                Verified COE
                            </span>
                        </div>
                    </div>

                    {/* Examination Schedule Table */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                            Course &amp; Exam Schedule
                        </h3>
                        <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="px-3.5 py-2">Exam Code</th>
                                        <th className="px-3.5 py-2">Title</th>
                                        <th className="px-3.5 py-2">Scheduled Date</th>
                                        <th className="px-3.5 py-2">Session Timing</th>
                                        <th className="px-3.5 py-2 text-center">Invigilator Initial</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-100">
                                        <td className="px-3.5 py-2.5 font-mono font-bold text-indigo-700">
                                            {exam?.programId?.toUpperCase()}-EX26
                                        </td>
                                        <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                                            {exam?.title ?? "Semester Examinations"}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-slate-700 font-medium">
                                            {new Date(exam?.createdAt || Date.now()).toLocaleDateString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-slate-700">10:00 AM – 01:00 PM (Morning)</td>
                                        <td className="px-3.5 py-2.5 text-center text-slate-300 border-l border-slate-100">
                                            ________________
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mandatory Candidate Instructions */}
                    <div className="space-y-1.5 text-[10px] text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200 print:bg-white print:border-slate-300">
                        <p className="font-bold text-slate-700 uppercase tracking-wide">
                            Instructions for Candidates:
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5">
                            <li>Candidates must occupy allotted seats 15 minutes before the commencement of examination.</li>
                            <li>Possession of mobile phones, smartwatches, or programmable calculators in the exam hall is strictly prohibited.</li>
                            <li>Carry your official University Student ID Card along with this E-Admit Card.</li>
                            <li>Admittance is subject to statutory 75% attendance compliance as verified by the Dean of Academic Affairs.</li>
                        </ul>
                    </div>

                    {/* Signatures & Controller Seal */}
                    <div className="pt-6 border-t border-slate-200 flex items-end justify-between text-xs">
                        <div className="text-center space-y-1">
                            <div className="h-8 border-b border-dashed border-slate-400 w-36"></div>
                            <span className="text-[10px] font-bold text-slate-500">Candidate Signature</span>
                        </div>

                        <div className="text-center space-y-1">
                            <div className="text-indigo-900 font-serif italic font-bold tracking-tight text-sm">
                                [Dr. V. K. Nautiyal]
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                                Controller of Examinations
                            </span>
                            <span className="text-[9px] text-slate-400 block font-mono">SRHU DEHRADUN</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
