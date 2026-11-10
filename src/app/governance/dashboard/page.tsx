"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    LayoutDashboard,
    Users,
    Clock,
    Building2,
    MessageSquare,
    CalendarDays,
    CheckCircle2,
    BellRing,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { Modal } from "@/components/admissions/Modal";
import {
    fetchDeanOverview,
    setFacultyPresence,
    sendMessage,
    todayIST,
    PRESENCE_LABELS,
    canManagePresence,
    type DeanOverview,
    type LiveClassView,
    type FacultyPresenceView,
    type ServerPresenceStatus,
} from "@/lib/governance";
import { fetchDepartments, type DepartmentListItem } from "@/lib/org-client";
import type { UserRole } from "@/types";

type Toast = { kind: "success" | "error"; message: string } | null;

const inputCls =
    "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors";

function StatusBadge({ status }: { status: FacultyPresenceView["status"] }) {
    const variant =
        status === "PRESENT"
            ? "success"
            : status === "ABSENT"
                ? "danger"
                : status === "ON_LEAVE"
                    ? "warning"
                    : "outline";
    return <Badge variant={variant}>{PRESENCE_LABELS[status]}</Badge>;
}

function LiveStatusChip({ status }: { status: LiveClassView["status"] }) {
    return status === "LIVE" ? (
        <Badge variant="success" className="uppercase tracking-wide">
            <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" /> In progress
        </Badge>
    ) : (
        <Badge variant="warning" className="uppercase tracking-wide">
            Starting soon
        </Badge>
    );
}

export default function DeanDashboardPage() {
    const [role, setRole] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [overview, setOverview] = useState<DeanOverview | null>(null);
    const [departments, setDepartments] = useState<DepartmentListItem[]>([]);
    const [deptId, setDeptId] = useState("");
    const [toast, setToast] = useState<Toast>(null);
    const [msgOpen, setMsgOpen] = useState(false);
    const [msgRecipients, setMsgRecipients] = useState<string[]>([]);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setRole(d?.user?.role))
            .catch(() => setRole(undefined));
    }, []);

    useEffect(() => {
        fetchDepartments({})
            .then((res) => setDepartments(res.items))
            .catch(() => setDepartments([]));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchDeanOverview({ departmentId: deptId || undefined });
            setOverview(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load dean dashboard");
        } finally {
            setLoading(false);
        }
    }, [deptId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    const canManage = canManagePresence(role as UserRole | undefined);

    const handleStatusChange = async (
        userId: string,
        status: ServerPresenceStatus
    ) => {
        const prev = overview;
        if (!prev) return;
        const date = todayIST();
        let next: DeanOverview | null = null;
        // optimistic update
        setOverview({
            ...prev,
            presence: prev.presence.map((p) =>
                p.userId === userId ? { ...p, status, markedBy: "me" } : p
            ),
            kpis: {
                ...prev.kpis,
                presentToday: prev.presence.filter((p) =>
                    p.userId === userId ? status === "PRESENT" : p.status === "PRESENT"
                ).length,
            },
        });
        try {
            const res = await setFacultyPresence({ userId, date, status });
            next = {
                ...prev,
                presence: prev.presence.map((p) =>
                    p.userId === userId
                        ? { ...p, status: res.presence.status, markedBy: res.presence.markedBy }
                        : p
                ),
            };
            setOverview(next);
            setToast({ kind: "success", message: `${PRESENCE_LABELS[status]} saved for today` });
        } catch (e) {
            setOverview(prev);
            setToast({ kind: "error", message: e instanceof Error ? e.message : "Failed to update presence" });
        }
    };

    const openMessage = (userId?: string) => {
        setMsgRecipients(userId ? [userId] : []);
        setMsgOpen(true);
    };

    const toggleRecipient = (userId: string) => {
        setMsgRecipients((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const kpis = overview?.kpis;

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <LayoutDashboard className="h-5 w-5 text-indigo-600" />
                        Dean Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Live oversight of your faculty, classes and presence
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={deptId}
                        onChange={(e) => setDeptId(e.target.value)}
                        className={inputCls + " w-auto min-w-44"}
                        aria-label="Filter by department"
                    >
                        <option value="">All departments</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                    <Link href="/academic/timetable">
                        <Button variant="outline" size="sm">
                            <CalendarDays className="h-4 w-4" /> Timetable
                        </Button>
                    </Link>
                    <Link href="/governance/faculty-presence">
                        <Button variant="outline" size="sm">
                            <Users className="h-4 w-4" /> Presence grid
                        </Button>
                    </Link>
                    {canManage && (
                        <Button variant="primary" size="sm" onClick={() => openMessage()}>
                            <MessageSquare className="h-4 w-4" /> Message faculty
                        </Button>
                    )}
                </div>
            </div>

            {toast && (
                <div
                    className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${toast.kind === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                        }`}
                    role="status"
                >
                    {toast.message}
                </div>
            )}

            {loading ? (
                <LoadingState rows={5} />
            ) : error ? (
                <ErrorState message={error} retry={() => void load()} />
            ) : !overview ? (
                <EmptyState title="Nothing to show" />
            ) : (
                <div className="space-y-6">
                    {/* KPI cards */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Card>
                            <CardContent className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Faculty</p>
                                    <p className="text-xl font-bold text-slate-900">{kpis?.facultyCount ?? 0}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Present today</p>
                                    <p className="text-xl font-bold text-slate-900">{kpis?.presentToday ?? 0}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Clock className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Live classes</p>
                                    <p className="text-xl font-bold text-slate-900">{kpis?.liveClasses ?? 0}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-sky-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Departments</p>
                                    <p className="text-xl font-bold text-slate-900">{kpis?.departmentCount ?? 0}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Live classes */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-indigo-600" /> Live & upcoming classes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {overview.liveClasses.length === 0 ? (
                                <EmptyState
                                    icon={Clock}
                                    title="No classes right now"
                                    description="No live or upcoming classes at this moment for the selected department."
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th className="px-5 py-3">Course</th>
                                                <th className="px-5 py-3">Class</th>
                                                <th className="px-5 py-3">Room</th>
                                                <th className="px-5 py-3">Faculty</th>
                                                <th className="px-5 py-3">Time</th>
                                                <th className="px-5 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {overview.liveClasses.map((lc) => (
                                                <tr key={lc.slotId} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-5 py-3 font-medium text-slate-900">{lc.courseTitle}</td>
                                                    <td className="px-5 py-3 text-slate-500">{lc.classLabel}</td>
                                                    <td className="px-5 py-3 text-slate-500">{lc.room ?? "—"}</td>
                                                    <td className="px-5 py-3">{lc.facultyName}</td>
                                                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                                                        {lc.startTime}–{lc.endTime}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <LiveStatusChip status={lc.status} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Faculty presence */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-indigo-600" /> Faculty presence · today
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {overview.presence.length === 0 ? (
                                <EmptyState
                                    icon={Users}
                                    title="No faculty found"
                                    description="No faculty members are currently assigned to this department."
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th className="px-5 py-3">Faculty</th>
                                                <th className="px-5 py-3">Department</th>
                                                <th className="px-5 py-3">Position</th>
                                                <th className="px-5 py-3">Status</th>
                                                {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {overview.presence.map((p) => (
                                                <tr key={p.userId} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-5 py-3 font-medium text-slate-900">{p.name}</td>
                                                    <td className="px-5 py-3 text-slate-500">{p.departmentName ?? "—"}</td>
                                                    <td className="px-5 py-3 text-slate-500">{p.position ?? "—"}</td>
                                                    <td className="px-5 py-3">
                                                        {canManage ? (
                                                            <select
                                                                value={p.status === "UNMARKED" ? "" : p.status}
                                                                onChange={(e) =>
                                                                    handleStatusChange(
                                                                        p.userId,
                                                                        e.target.value as ServerPresenceStatus
                                                                    )
                                                                }
                                                                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                                aria-label={`Status for ${p.name}`}
                                                            >
                                                                <option value="" disabled>
                                                                    Unmarked
                                                                </option>
                                                                <option value="PRESENT">Present</option>
                                                                <option value="ABSENT">Absent</option>
                                                                <option value="ON_LEAVE">On leave</option>
                                                            </select>
                                                        ) : (
                                                            <StatusBadge status={p.status} />
                                                        )}
                                                    </td>
                                                    {canManage && (
                                                        <td className="px-5 py-3 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openMessage(p.userId)}
                                                            >
                                                                <MessageSquare className="h-3.5 w-3.5" /> Message
                                                            </Button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <MessageComposeModal
                open={msgOpen}
                onClose={() => setMsgOpen(false)}
                faculty={overview?.presence ?? []}
                selected={msgRecipients}
                onToggle={toggleRecipient}
                onToast={setToast}
            />
        </div>
    );
}

function MessageComposeModal({
    open,
    onClose,
    faculty,
    selected,
    onToggle,
    onToast,
}: {
    open: boolean;
    onClose: () => void;
    faculty: FacultyPresenceView[];
    selected: string[];
    onToggle: (userId: string) => void;
    onToast: (t: Toast) => void;
}) {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);

    const submit = async () => {
        if (selected.length === 0 || !subject.trim()) {
            onToast({ kind: "error", message: "Select at least one recipient and enter a subject" });
            return;
        }
        setSending(true);
        try {
            const res = await sendMessage({
                recipientUserIds: selected,
                subject: subject.trim(),
                body: body.trim() || undefined,
            });
            onToast({ kind: "success", message: `Message sent to ${res.sent} recipient(s)` });
            setSubject("");
            setBody("");
            onClose();
        } catch (e) {
            onToast({ kind: "error", message: e instanceof Error ? e.message : "Failed to send message" });
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Message faculty"
            description="Send an in-app notification to selected recipients."
            onClose={onClose}
            wide
        >
            {faculty.length === 0 ? (
                <EmptyState icon={Users} title="No recipients" />
            ) : (
                <div className="space-y-4">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Recipients ({selected.length})
                        </p>
                        <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {faculty.map((f) => {
                                const checked = selected.includes(f.userId);
                                return (
                                    <label
                                        key={f.userId}
                                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => onToggle(f.userId)}
                                            className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium text-slate-800">{f.name}</span>
                                        <span className="text-xs text-slate-400 ml-auto">
                                            {f.departmentName ?? "—"}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Subject
                        </label>
                        <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. Reminder: class observation this afternoon"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Body (optional)
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={4}
                            placeholder="Add details…"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={() => void submit()} loading={sending}>
                            <BellRing className="h-4 w-4" /> Send
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
