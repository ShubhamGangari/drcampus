"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Modal } from "@/components/admissions/Modal";
import { EmptyState, ErrorState, Spinner } from "@/components/admissions/States";
import {
    AttendanceApiError,
    AttendanceDayRow,
    AttendanceTeacherSummary,
    fetchAttendanceDetail,
    updateAttendanceRecord,
} from "@/lib/attendance";

interface Props {
    open: boolean;
    onClose: () => void;
    courseId: string;
    schoolId?: string;
    student: { studentId: string; rollNo: string; name: string } | null;
    /** Only Faculty may edit individual records. */
    canEdit?: boolean;
}

function formatDisplayDate(iso: string): string {
    const d = new Date(iso + "T00:00:00.000Z");
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function StatusBadge({ status }: { status: string }) {
    if (status === "PRESENT") {
        return (
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Present
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
            <XCircle className="h-3 w-3" /> Absent
        </span>
    );
}

export function AttendanceDetailModal({ open, onClose, courseId, schoolId, student, canEdit }: Props) {
    const [days, setDays] = useState<AttendanceDayRow[]>([]);
    const [teachers, setTeachers] = useState<AttendanceTeacherSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!courseId || !student) return;
        setLoading(true);
        setLoadError(null);
        try {
            const data = await fetchAttendanceDetail({
                courseId,
                schoolId,
                studentId: student.studentId,
            });
            setDays(data.days);
            setTeachers(data.teachers);
        } catch (e) {
            setLoadError(e instanceof AttendanceApiError ? e.message : "Unable to load attendance detail.");
        } finally {
            setLoading(false);
        }
    }, [courseId, schoolId, student]);

    useEffect(() => {
        if (open) void load();
    }, [open, load]);

    const toggleStatus = async (day: AttendanceDayRow) => {
        if (!student || !canEdit || savingId) return;
        const next = day.status === "PRESENT" ? "ABSENT" : "PRESENT";
        setSavingId(day.recordId);
        try {
            await updateAttendanceRecord({
                courseId,
                schoolId,
                studentId: student.studentId,
                date: day.date,
                status: next,
            });
            setDays((prev) =>
                prev.map((d) =>
                    d.recordId === day.recordId ? { ...d, status: next, teacherName: "You" } : d
                )
            );
        } catch (e) {
            setLoadError(e instanceof AttendanceApiError ? e.message : "Unable to update attendance.");
        } finally {
            setSavingId(null);
        }
    };

    const presentCount = days.filter((d) => d.status === "PRESENT").length;
    const pct = days.length ? Math.round((presentCount / days.length) * 10000) / 100 : 0;

    return (
        <Modal
            open={open}
            onClose={onClose}
            wide
            title={student ? `${student.name} — Attendance` : "Attendance detail"}
            description={student ? `Roll No ${student.rollNo}` : undefined}
        >
            <div className="space-y-5">
                {student && days.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-center">
                            <div className="text-lg font-black text-slate-900 tabular-nums">{days.length}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total days</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-center">
                            <div className="text-lg font-black text-emerald-600 tabular-nums">{presentCount}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Present</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-center">
                            <div className="text-lg font-black text-slate-900 tabular-nums">{pct.toFixed(2)}%</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Percentage</div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <Spinner label="Loading attendance detail…" />
                ) : loadError ? (
                    <ErrorState message={loadError} onRetry={() => void load()} />
                ) : days.length === 0 ? (
                    <EmptyState
                        title="No attendance recorded"
                        description="No day-wise records exist for this student in this course."
                    />
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <div className="max-h-[45vh] overflow-y-auto">
                            <div className="divide-y divide-slate-100">
                                {days.map((day) => (
                                    <div
                                        key={day.recordId}
                                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-slate-800">{formatDisplayDate(day.date)}</div>
                                                <div className="text-[11px] text-slate-500">
                                                    {day.teacherName ? `Marked by ${day.teacherName}` : "Marked by system"}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:justify-end">
                                            <StatusBadge status={day.status} />
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => void toggleStatus(day)}
                                                    disabled={!!savingId}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                    {savingId === day.recordId ? "Saving…" : day.status === "PRESENT" ? "Mark absent" : "Mark present"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {teachers.length > 0 && (
                    <div>
                        <h3 className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Marked by teacher
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {teachers.map((t) => (
                                <div
                                    key={t.teacherId}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5"
                                >
                                    <span className="text-xs font-bold text-slate-800">{t.teacherName}</span>
                                    <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-black text-slate-500 tabular-nums">
                                        {t.markedCount} day{t.markedCount === 1 ? "" : "s"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
