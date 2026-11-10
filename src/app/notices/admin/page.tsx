"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/notices/NoticesShell";
import { PublishNoticeModal } from "@/components/notices/PublishNoticeModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageNotices,
    CreateNoticeInput,
    deleteNotice,
    fetchNoticeStats,
    fetchNotices,
    Notice,
    NoticesApiError,
    NOTICE_CATEGORY_LABELS,
    publishNotice,
    updateNotice,
} from "@/lib/notices";

export default function NoticesAdminPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageNotices(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [rows, setRows] = useState<Notice[]>([]);
    const [reads, setReads] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Notice | null>(null);
    const [busy, setBusy] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        if (!canManage) return;
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchNotices({
                schoolId: isCentral && schoolId ? schoolId : undefined,
            });
            setRows(res.notices);
            const stats = await Promise.all(
                res.notices.map((n) =>
                    fetchNoticeStats(n.id)
                        .then((s) => [n.id, s.reads] as const)
                        .catch(() => [n.id, 0] as const)
                )
            );
            setReads(Object.fromEntries(stats));
        } catch (e) {
            setLoadError(e instanceof NoticesApiError ? e.message : "Unable to load notices.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId, canManage]);

    useEffect(() => {
        if (canManage) load();
    }, [load, canManage]);

    const submit = async (input: CreateNoticeInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            if (editing) {
                await updateNotice(editing.id, input);
                setToast({ message: "Notice updated.", type: "success" });
            } else {
                await publishNotice(input);
                setToast({ message: "Notice published.", type: "success" });
            }
            setModalOpen(false);
            setEditing(null);
            load();
        } catch (e) {
            setSubmitError(e instanceof NoticesApiError ? e.message : "Unable to save notice.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        setBusyId(id);
        try {
            await deleteNotice(id);
            setToast({ message: "Notice deleted.", type: "success" });
            load();
        } catch (e) {
            setToast({
                message: e instanceof NoticesApiError ? e.message : "Unable to delete notice.",
                type: "error",
            });
        } finally {
            setBusyId(null);
        }
    };

    const openCreate = () => {
        setEditing(null);
        setSubmitError(null);
        setModalOpen(true);
    };

    const openEdit = (notice: Notice) => {
        setEditing(notice);
        setSubmitError(null);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
        setSubmitError(null);
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    if (!canManage) {
        return (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
                    <ShieldAlert className="h-6 w-6 text-rose-500" />
                </div>
                <p className="text-sm font-bold text-slate-700">Publishing requires staff access</p>
                <p className="text-xs text-slate-500 mt-1">
                    Students can view the board, but only staff can publish or manage notices.
                </p>
            </div>
        );
    }

    return (
        <div>
            <PageTitle
                title="Publish Notices"
                subtitle="Create, edit and remove notices from the university board."
                action={
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                        <Plus className="h-4 w-4" /> Publish Notice
                    </button>
                }
            />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="admin-school"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All schools</option>
                        <option value="SCHOOL_1">School 1</option>
                        <option value="SCHOOL_2">School 2</option>
                    </select>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : rows.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No notices published"
                        description="Publish the first notice to the university board."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Notice</th>
                                    <th className="px-5 py-3 font-bold">Published</th>
                                    <th className="px-5 py-3 font-bold">Expires</th>
                                    <th className="px-5 py-3 font-bold">Reads</th>
                                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((notice) => (
                                    <tr
                                        key={notice.id}
                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-col gap-1">
                                                <p className="font-bold text-slate-900">{notice.title}</p>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                        {NOTICE_CATEGORY_LABELS[notice.category] ?? notice.category}
                                                    </span>
                                                    {notice.pinned && (
                                                        <span className="inline-flex text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                                                            Pinned
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{formatDate(notice.publishedAt)}</td>
                                        <td className="px-5 py-3.5 text-slate-600">
                                            {notice.expiresAt ? formatDate(notice.expiresAt) : <span className="text-slate-400">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                                <Eye className="h-3.5 w-3.5 text-slate-400" />
                                                {reads[notice.id] ?? 0}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(notice)}
                                                    aria-label="Edit notice"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => remove(notice.id)}
                                                    disabled={busyId === notice.id}
                                                    aria-label="Delete notice"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <PublishNoticeModal
                open={modalOpen}
                busy={busy}
                error={submitError}
                schoolRequired={isCentral}
                initial={editing}
                onClose={closeModal}
                onSubmit={submit}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
