"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Trash2, Plus, UserRound, GraduationCap } from "lucide-react";
import { PageTitle } from "@/components/parent/ParentShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
    ParentLinkRow,
    ParentApiError,
    fetchParentLinks,
    createParentLink,
    deleteParentLink,
} from "@/lib/parent";
import { fetchUsers, RbacUser } from "@/lib/rbac-client";
import { fetchStudents, StudentSummary } from "@/lib/students";

const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function ParentManagePage() {
    const [links, setLinks] = useState<ParentLinkRow[]>([]);
    const [parents, setParents] = useState<RbacUser[]>([]);
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [parentUserId, setParentUserId] = useState("");
    const [studentId, setStudentId] = useState("");
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [linkRes, userRes, studentRes] = await Promise.all([
                fetchParentLinks(),
                fetchUsers({ role: "PARENT" }),
                fetchStudents(),
            ]);
            setLinks(linkRes.links);
            setParents(userRes.users.filter((u) => u.active));
            setStudents(studentRes.filter((s) => s.status === "ACTIVE"));
        } catch (e) {
            setLoadError(e instanceof ParentApiError ? e.message : "Unable to load parent links.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async () => {
        setFormError(null);
        if (!parentUserId) {
            setFormError("Select a parent user.");
            return;
        }
        if (!studentId) {
            setFormError("Select a student.");
            return;
        }
        setBusy(true);
        try {
            const res = await createParentLink({ parentUserId, studentId });
            setLinks((prev) => [res.link, ...prev]);
            setFormOpen(false);
            setParentUserId("");
            setStudentId("");
        } catch (e) {
            setFormError(e instanceof ParentApiError ? e.message : "Unable to create the link.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        setDeletingId(id);
        setDeleteError(null);
        try {
            await deleteParentLink(id);
            setLinks((prev) => prev.filter((l) => l.id !== id));
        } catch (e) {
            setDeleteError(e instanceof ParentApiError ? e.message : "Unable to remove the link.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div>
            <PageTitle
                title="Manage Links"
                subtitle="Link parent accounts to students so they can view ward progress."
                action={
                    <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
                        <Plus className="h-4 w-4" /> New link
                    </Button>
                }
            />

            {formOpen && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-bold text-slate-900 mb-4">New parent–student link</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Parent user
                            </label>
                            <div className="relative">
                                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <select
                                    value={parentUserId}
                                    onChange={(e) => setParentUserId(e.target.value)}
                                    className={`${inputCls} pl-9`}
                                >
                                    <option value="">Select a parent…</option>
                                    {parents.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {parents.length === 0 && (
                                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                                    No PARENT users found yet — create one in User Management first.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Student
                            </label>
                            <div className="relative">
                                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <select
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className={`${inputCls} pl-9`}
                                >
                                    <option value="">Select a student…</option>
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.firstName} {s.lastName} · {s.rollNo}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {formError && <p className="mt-3 text-xs font-medium text-rose-600">{formError}</p>}

                    <div className="mt-4 flex items-center gap-2">
                        <Button size="sm" onClick={submit} loading={busy}>
                            {busy ? "Creating…" : "Create link"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setFormOpen(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {deleteError && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-medium text-rose-700">
                    {deleteError}
                </div>
            )}

            {loading && <LoadingSkeleton rows={5} />}

            {!loading && loadError && <ErrorState message={loadError} onRetry={load} />}

            {!loading && !loadError && links.length === 0 && (
                <EmptyState
                    title="No links yet"
                    description="No parent–student links exist. Create the first link to grant a parent access to their ward."
                    action={
                        <Button size="sm" onClick={() => setFormOpen(true)}>
                            <Plus className="h-4 w-4" /> Create a link
                        </Button>
                    }
                />
            )}

            {!loading && !loadError && links.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100 bg-slate-50/60">
                                    <th className="py-3 px-5">Parent</th>
                                    <th className="py-3 px-5">Student</th>
                                    <th className="py-3 px-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {links.map((link) => (
                                    <tr key={link.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                                        <td className="py-3.5 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                    <UserRound className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{link.parentName}</p>
                                                    <Badge variant="primary" className="mt-0.5">PARENT</Badge>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                    <GraduationCap className="h-4 w-4" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-800 truncate">{link.studentName}</p>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-5 text-right">
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                loading={deletingId === link.id}
                                                disabled={deletingId !== null}
                                                onClick={() => remove(link.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Remove
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && !loadError && links.length > 0 && (
                <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                    <Link2 className="h-3.5 w-3.5" /> Removing a link immediately hides that ward from the parent portal.
                </p>
            )}
        </div>
    );
}
