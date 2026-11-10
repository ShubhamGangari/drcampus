"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    Send,
    ArrowLeft,
    UserRound,
    ClipboardList,
    AlertOctagon,
    CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/grievance/GrievanceShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageGrievance,
    fetchTicket,
    GRIEVANCE_PRIORITIES,
    GRIEVANCE_STATUSES,
    GrievanceApiError,
    GrievanceDetail,
    GrievanceStatus,
    replyTicket,
    updateTicket,
} from "@/lib/grievance";

const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const STATUS_TONE: Record<GrievanceStatus, string> = {
    OPEN: "bg-amber-50 text-amber-700 border-amber-200",
    IN_PROGRESS: "bg-indigo-50 text-indigo-700 border-indigo-200",
    RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function GrievanceDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";

    const { currentUser } = useUniversity();
    const canManage = canManageGrievance(currentUser);

    const [detail, setDetail] = useState<GrievanceDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // reply
    const [replyBody, setReplyBody] = useState("");
    const [replyBusy, setReplyBusy] = useState(false);
    const [replyError, setReplyError] = useState<string | null>(null);

    // admin controls
    const [status, setStatus] = useState("");
    const [priority, setPriority] = useState("");
    const [resolution, setResolution] = useState("");
    const [adminBusy, setAdminBusy] = useState(false);
    const [adminError, setAdminError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchTicket(id);
            setDetail(res);
            setStatus(res.ticket.status);
            setPriority(res.ticket.priority);
            if (res.ticket.resolution) setResolution(res.ticket.resolution);
        } catch (e) {
            setLoadError(e instanceof GrievanceApiError ? e.message : "Unable to load ticket.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    const sendReply = async () => {
        if (!replyBody.trim()) {
            setReplyError("Reply cannot be empty.");
            return;
        }
        setReplyError(null);
        setReplyBusy(true);
        try {
            const res = await replyTicket(id, { body: replyBody.trim() });
            setDetail((prev) => (prev ? { ticket: prev.ticket, messages: [...prev.messages, res.message] } : prev));
            setReplyBody("");
        } catch (e) {
            setReplyError(e instanceof GrievanceApiError ? e.message : "Unable to send reply.");
        } finally {
            setReplyBusy(false);
        }
    };

    const applyAdmin = async (patch: { status?: string; priority?: string; resolution?: string }) => {
        setAdminError(null);
        setAdminBusy(true);
        try {
            const res = await updateTicket(
                id,
                patch.status
                    ? { status: patch.status as GrievanceStatus, resolution: patch.resolution ?? undefined }
                    : { priority: patch.priority as (typeof GRIEVANCE_PRIORITIES)[number] }
            );
            setDetail((prev) => (prev ? { ticket: res.ticket, messages: prev.messages } : prev));
            setStatus(res.ticket.status);
            setPriority(res.ticket.priority);
            if (res.ticket.resolution) setResolution(res.ticket.resolution);
        } catch (e) {
            setAdminError(e instanceof GrievanceApiError ? e.message : "Unable to update ticket.");
        } finally {
            setAdminBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Ticket detail"
                subtitle={detail ? `${detail.ticket.ticketNo} · ${detail.ticket.category.replace("_", " ")}` : " "}
                action={
                    <Link
                        href="/grievance"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to dashboard
                    </Link>
                }
            />

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : detail ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Meta card */}
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_TONE[detail.ticket.status]}`}>
                                    {detail.ticket.status.replace("_", " ")}
                                </span>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                                    {detail.ticket.priority}
                                </span>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                                    {detail.ticket.category.replace("_", " ")}
                                </span>
                            </div>
                            <h2 className="mt-3 text-lg font-black text-slate-900">{detail.ticket.subject}</h2>
                            {detail.ticket.resolution && (
                                <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Resolution</p>
                                    <p className="text-sm text-emerald-800 mt-1">{detail.ticket.resolution}</p>
                                </div>
                            )}
                        </div>

                        {/* Thread */}
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center gap-2">
                                <ClipboardList className="h-4 w-4 text-slate-400" />
                                <span className="text-sm font-bold text-slate-900">Conversation</span>
                            </div>
                            <ul className="divide-y divide-slate-100">
                                {detail.messages.map((m) => (
                                    <li key={m.id} className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                                <UserRound className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="text-xs font-bold text-slate-800">{m.authorName}</span>
                                            <span className="text-[11px] text-slate-400 ml-auto">
                                                {new Date(m.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-700 leading-relaxed">{m.body}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Reply */}
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                            <p className="text-sm font-bold text-slate-900 mb-3">Add reply</p>
                            <textarea
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                rows={3}
                                placeholder="Type your reply…"
                                className={inputCls}
                            />
                            {replyError && <p className="mt-2 text-xs font-medium text-rose-600">{replyError}</p>}
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={sendReply}
                                    disabled={replyBusy}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    {replyBusy ? "Sending…" : "Send reply"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Admin panel */}
                    {canManage && (
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm h-fit p-5 space-y-5">
                            <p className="text-sm font-bold text-slate-900">Staff actions</p>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className={inputCls}
                                >
                                    {GRIEVANCE_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {s.replace("_", " ")}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Priority
                                </label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className={inputCls}
                                >
                                    {GRIEVANCE_PRIORITIES.map((p) => (
                                        <option key={p} value={p}>
                                            {p}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Resolution note
                                </label>
                                <textarea
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    rows={2}
                                    placeholder="Required before marking resolved"
                                    className={inputCls}
                                />
                            </div>

                            {adminError && <p className="text-xs font-medium text-rose-600">{adminError}</p>}

                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyAdmin({ status, resolution })}
                                    disabled={adminBusy}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {adminBusy ? "Saving…" : "Update status"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyAdmin({ priority })}
                                    disabled={adminBusy}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    <AlertOctagon className="h-3.5 w-3.5" />
                                    Set priority
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
