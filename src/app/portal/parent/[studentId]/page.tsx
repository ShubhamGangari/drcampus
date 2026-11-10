"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarCheck, IndianRupee, BookOpenCheck, CalendarClock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/parent/ParentShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Badge } from "@/components/ui/Badge";
import { WardDetail, ParentApiError, fetchWardDetail } from "@/lib/parent";

type Tab = "attendance" | "fees" | "results" | "exams";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "fees", label: "Fees", icon: IndianRupee },
    { id: "results", label: "Results", icon: BookOpenCheck },
    { id: "exams", label: "Exams", icon: CalendarClock },
];

function formatINR(value: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ProgressBar({ percentage }: { percentage: number }) {
    const tone = percentage >= 75 ? "bg-emerald-500" : percentage >= 60 ? "bg-amber-500" : "bg-rose-500";
    return (
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
        </div>
    );
}

export default function ParentWardDetailPage() {
    const params = useParams<{ studentId: string }>();
    const studentId = params?.studentId ?? "";

    const [activeTab, setActiveTab] = useState<Tab>("attendance");
    const [detail, setDetail] = useState<WardDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchWardDetail(studentId);
            setDetail(data.detail);
        } catch (e) {
            setError(e instanceof ParentApiError ? e.message : "Unable to load student details.");
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    useEffect(() => {
        if (studentId) load();
    }, [studentId, load]);

    if (loading) {
        return (
            <div>
                <PageTitle title="Loading…" />
                <LoadingSkeleton rows={6} />
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <PageTitle title="Details" />
                <ErrorState message={error} onRetry={load} />
            </div>
        );
    }

    if (!detail) {
        return (
            <div>
                <PageTitle title="Details" />
                <EmptyState title="No data" description="No ward detail is available." />
            </div>
        );
    }

    const { summary } = detail;

    return (
        <div>
            <Link
                href="/portal/parent"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-4 transition-colors cursor-pointer"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> All wards
            </Link>

            <PageTitle
                title={summary.name}
                subtitle={`${summary.rollNo} · ${summary.program} · ${summary.className}`}
            />

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-6">
                {TABS.map((tab) => {
                    const active = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            aria-current={active ? "page" : undefined}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${active
                                ? "bg-indigo-50/90 text-indigo-700 font-bold border border-indigo-200 shadow-2xs"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
                                }`}
                        >
                            <Icon className={`h-3.5 w-3.5 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === "attendance" && (
                <div className="space-y-4">
                    {detail.attendance.length === 0 && (
                        <EmptyState title="No attendance data" description="Attendance has not been recorded for this ward yet." />
                    )}
                    {detail.attendance.map((row) => (
                        <div key={row.courseId} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">{row.title}</p>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        {row.code} · {row.credits} credits
                                    </p>
                                </div>
                                <Badge
                                    variant={row.percentage == null ? "outline" : row.percentage >= 75 ? "success" : row.percentage >= 60 ? "warning" : "danger"}
                                >
                                    {row.percentage != null ? `${row.percentage.toFixed(1)}%` : "—"}
                                </Badge>
                            </div>
                            {row.percentage != null && <ProgressBar percentage={row.percentage} />}
                            <p className="text-[11px] text-slate-500 mt-2 font-medium">
                                {row.presentDays} of {row.totalDays} days present
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "fees" && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current due</p>
                            <p className={`text-2xl font-black mt-1 ${detail.fees.currentDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                {formatINR(detail.fees.currentDue)}
                            </p>
                        </div>
                        <Badge variant={detail.fees.currentDue > 0 ? "danger" : "success"}>
                            {detail.fees.currentDue > 0 ? "Outstanding" : "Clear"}
                        </Badge>
                    </div>

                    <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Invoices</h3>
                        {detail.fees.invoices.length === 0 && (
                            <EmptyState title="No invoices" description="No fee invoices have been raised for this ward." />
                        )}
                        <div className="space-y-3">
                            {detail.fees.invoices.map((inv) => (
                                <div key={inv.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{inv.invoiceNo}</p>
                                        <p className="text-[11px] text-slate-500 font-medium">Due {formatDate(inv.dueDate)}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black text-slate-900">{formatINR(inv.amount)}</p>
                                        <Badge variant={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "danger"}>
                                            {inv.status.replace("_", " ")}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Payments</h3>
                        {detail.fees.payments.length === 0 && (
                            <EmptyState title="No payments" description="No payments have been recorded for this ward yet." />
                        )}
                        <div className="space-y-3">
                            {detail.fees.payments.map((p) => (
                                <div key={p.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{p.receiptNo}</p>
                                        <p className="text-[11px] text-slate-500 font-medium">
                                            {p.mode} · {formatDate(p.createdAt)}
                                        </p>
                                    </div>
                                    <p className="text-sm font-black text-emerald-600 shrink-0">{formatINR(p.amount)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "results" && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Latest GPA</p>
                            <p className="text-2xl font-black mt-1 text-slate-900">
                                {detail.results.latestGpa != null ? detail.results.latestGpa.toFixed(2) : "—"}
                            </p>
                        </div>
                        <Badge variant="primary">{detail.results.semesters.length} semester(s)</Badge>
                    </div>

                    {detail.results.semesters.length === 0 && (
                        <EmptyState title="No published results" description="Results have not been published for this ward yet." />
                    )}

                    {detail.results.semesters.map((sem) => (
                        <div key={sem.semester} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-black text-slate-900">Semester {sem.semester}</p>
                                    <p className="text-[11px] text-slate-500 font-medium">{sem.academicYear}</p>
                                </div>
                                <Badge variant="primary">SGPA {sem.sgpa.toFixed(2)}</Badge>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
                                            <th className="py-2 pr-3">Course</th>
                                            <th className="py-2 pr-3">Credits</th>
                                            <th className="py-2 pr-3">Internal</th>
                                            <th className="py-2 pr-3">External</th>
                                            <th className="py-2 pr-3">Total</th>
                                            <th className="py-2">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sem.courses.map((c, i) => (
                                            <tr key={i} className="border-b border-slate-50 last:border-0">
                                                <td className="py-2.5 pr-3 text-sm font-semibold text-slate-800 truncate max-w-[220px]">
                                                    {c.title ?? c.code ?? "Course"}
                                                </td>
                                                <td className="py-2.5 pr-3 text-sm text-slate-600">{c.credits}</td>
                                                <td className="py-2.5 pr-3 text-sm text-slate-600">{c.internalMarks}</td>
                                                <td className="py-2.5 pr-3 text-sm text-slate-600">{c.externalMarks}</td>
                                                <td className="py-2.5 pr-3 text-sm font-bold text-slate-800">{c.totalMarks}</td>
                                                <td className="py-2.5">
                                                    <Badge variant="outline">{c.grade}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "exams" && (
                <div className="space-y-4">
                    {detail.exams.upcoming.length === 0 && (
                        <EmptyState title="No upcoming exams" description="No exams are scheduled for this ward at the moment." />
                    )}
                    {detail.exams.upcoming.map((exam) => (
                        <div key={exam.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-start gap-4">
                            <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                <CalendarClock className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-slate-900">{exam.title}</p>
                                <p className="text-[11px] text-slate-500 font-medium">{exam.code}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-medium">
                                    <span>{formatDate(exam.examDate)}</span>
                                    <span>·</span>
                                    <span>{exam.startTime}</span>
                                    <span>·</span>
                                    <span>{exam.venue}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
