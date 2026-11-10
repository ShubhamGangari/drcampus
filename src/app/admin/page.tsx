"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminShell";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { OfficerEditModal } from "@/components/admin/OfficerEditModal";
import { OfficerModal } from "@/components/admin/OfficerModal";
import { RoleModal } from "@/components/admin/RoleModal";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { Toast } from "@/components/admissions/Toast";
import { useUniversity } from "@/context/UniversityContext";
import { fetchSchools } from "@/lib/fees";
import {
    createOfficer,
    createRole,
    CreateOfficerInput,
    CreateRoleInput,
    deleteRole,
    fetchRoles,
    fetchUsers,
    RbacApiError,
    RbacRole,
    RbacUser,
    ROLE_LABELS,
    updateOfficer,
    UpdateOfficerInput,
    updateRole,
    UpdateRoleInput,
} from "@/lib/rbac-client";

interface RoleModalState {
    open: boolean;
    mode: "create" | "edit";
    record: RbacRole | null;
}

interface OfficerEditModalState {
    open: boolean;
    record: RbacUser | null;
}

type ConfirmKind = "role-delete" | "officer-toggle";

interface ConfirmState {
    open: boolean;
    kind: ConfirmKind;
    record: RbacRole | RbacUser | null;
}

/**
 * Admin Console (`/admin`). Spec §3: two tabs — Roles (default) and Officers
 * (`?tab=officers`). Only SUPER_ADMIN is permitted.
 */
export default function AdminPage() {
    const { currentUser } = useUniversity();
    const searchParams = useSearchParams();
    const tab = searchParams.get("tab") ?? "roles";
    const isOfficers = tab === "officers";

    const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

    const [roles, setRoles] = useState<RbacRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [users, setUsers] = useState<RbacUser[]>([]);
    const [userLoading, setUserLoading] = useState(false);
    const [userLoadError, setUserLoadError] = useState<string | null>(null);
    const [q, setQ] = useState("");

    const [roleModal, setRoleModal] = useState<RoleModalState>({ open: false, mode: "create", record: null });
    const [officerModal, setOfficerModal] = useState(false);
    const [officerEditModal, setOfficerEditModal] = useState<OfficerEditModalState>({ open: false, record: null });
    const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({ open: false, kind: "role-delete", record: null });

    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        fetchSchools()
            .then(setSchools)
            .catch(() => {
                /* schools are a convenience reference; roles still work */
            });
    }, []);

    const loadRoles = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchRoles();
            setRoles(res.roles);
        } catch (e) {
            setLoadError(e instanceof RbacApiError ? e.message : "Unable to load roles.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRoles();
    }, [loadRoles]);

    const loadUsers = useCallback(async () => {
        setUserLoading(true);
        setUserLoadError(null);
        try {
            const res = await fetchUsers(q ? { q } : {});
            setUsers(res.users);
        } catch (e) {
            setUserLoadError(e instanceof RbacApiError ? e.message : "Unable to load officers.");
        } finally {
            setUserLoading(false);
        }
    }, [q]);

    useEffect(() => {
        if (isOfficers) {
            loadUsers();
        }
    }, [isOfficers, loadUsers]);

    const customRoleMap = new Map(roles.map((r) => [r.id, r.name]));
    const schoolName = (id: string | null) => (id ? schools.find((s) => s.id === id)?.name ?? "School" : "Global");

    // ---- Roles actions ---------------------------------------------------------

    const handleRoleSubmit = async (input: CreateRoleInput | UpdateRoleInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            if (roleModal.mode === "edit" && roleModal.record) {
                const updated = await updateRole(roleModal.record.id, input as UpdateRoleInput);
                setRoles((prev) => prev.map((r) => (r.id === updated.role.id ? updated.role : r)));
                setToast({ message: "Role updated.", type: "success" });
            } else {
                const created = await createRole(input as CreateRoleInput);
                setRoles((prev) => [created.role, ...prev]);
                setToast({ message: `Role "${created.role.name}" created.`, type: "success" });
            }
            setRoleModal({ open: false, mode: "create", record: null });
        } catch (e) {
            setSubmitError(e instanceof RbacApiError ? e.message : "Unable to save role.");
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteRole = async () => {
        const record = confirmDialog.record as RbacRole | null;
        if (!record) return;
        setBusy(true);
        setSubmitError(null);
        try {
            await deleteRole(record.id);
            setRoles((prev) => prev.filter((r) => r.id !== record.id));
            setToast({ message: `Role "${record.name}" deleted.`, type: "success" });
            setConfirmDialog({ open: false, kind: "role-delete", record: null });
        } catch (e) {
            // 409 ROLE_IN_USE surfaces the backend message.
            setToast({
                message: e instanceof RbacApiError ? e.message : "Unable to delete role.",
                type: "error",
            });
            setConfirmDialog({ open: false, kind: "role-delete", record: null });
        } finally {
            setBusy(false);
        }
    };

    // ---- Officer actions -------------------------------------------------------

    const handleOfficerCreate = async (input: CreateOfficerInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            const created = await createOfficer(input);
            setUsers((prev) => [created.user, ...prev]);
            setToast({ message: `${created.user.name} added as officer.`, type: "success" });
            setOfficerModal(false);
        } catch (e) {
            setSubmitError(e instanceof RbacApiError ? e.message : "Unable to create officer.");
        } finally {
            setBusy(false);
        }
    };

    const handleOfficerEdit = async (id: string, input: UpdateOfficerInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            const updated = await updateOfficer(id, input);
            setUsers((prev) => prev.map((u) => (u.id === updated.user.id ? updated.user : u)));
            setToast({ message: `Role updated for ${updated.user.name}.`, type: "success" });
            setOfficerEditModal({ open: false, record: null });
        } catch (e) {
            setSubmitError(e instanceof RbacApiError ? e.message : "Unable to update officer role.");
        } finally {
            setBusy(false);
        }
    };

    const handleToggleActive = async () => {
        const record = confirmDialog.record as RbacUser | null;
        if (!record) return;
        setBusy(true);
        setSubmitError(null);
        try {
            const updated = await updateOfficer(record.id, { active: !record.active });
            setUsers((prev) => prev.map((u) => (u.id === updated.user.id ? updated.user : u)));
            setToast({
                message: updated.user.active ? `${updated.user.name} reactivated.` : `${updated.user.name} deactivated.`,
                type: "success",
            });
            setConfirmDialog({ open: false, kind: "officer-toggle", record: null });
        } catch (e) {
            setToast({
                message: e instanceof RbacApiError ? e.message : "Unable to update officer.",
                type: "error",
            });
            setConfirmDialog({ open: false, kind: "officer-toggle", record: null });
        } finally {
            setBusy(false);
        }
    };

    const confirmDialogRecord = confirmDialog.record;
    const confirmOfficerActive =
        confirmDialog.kind !== "role-delete"
            ? (confirmDialogRecord as RbacUser | null)?.active ?? false
            : false;

    if (currentUser?.role !== "SUPER_ADMIN") {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <EmptyState title="Restricted" description="Only a Super Admin can access the Admin Console." />
            </div>
        );
    }

    return (
        <div>
            {isOfficers ? (
                <PageTitle
                    title="Officers"
                    subtitle="Provision accounts, assign roles and manage access."
                    action={
                        <button
                            type="button"
                            onClick={() => setOfficerModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            New officer
                        </button>
                    }
                />
            ) : (
                <PageTitle
                    title="Roles"
                    subtitle="Custom roles and the permissions they grant, scoped per school."
                    action={
                        <button
                            type="button"
                            onClick={() => setRoleModal({ open: true, mode: "create", record: null })}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            New role
                        </button>
                    }
                />
            )}

            {isOfficers ? (
                <div>
                    <div className="relative mb-4">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search by name or email…"
                            className="w-full sm:w-72 rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
                            aria-label="Search officers"
                        />
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {userLoading ? (
                            <div className="p-6">
                                <LoadingSkeleton rows={6} />
                            </div>
                        ) : userLoadError ? (
                            <ErrorState message={userLoadError} onRetry={loadUsers} />
                        ) : users.length === 0 ? (
                            <EmptyState
                                title={q ? "No matching officers" : "No officers yet"}
                                description={
                                    q
                                        ? "Try a different search term."
                                        : "Officers you provision will appear here. Create one to get started."
                                }
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                                        <tr>
                                            <th className="px-5 py-3.5">Name</th>
                                            <th className="px-5 py-3.5">Email</th>
                                            <th className="px-5 py-3.5">Role</th>
                                            <th className="px-5 py-3.5">Custom role</th>
                                            <th className="px-5 py-3.5">School</th>
                                            <th className="px-5 py-3.5">Status</th>
                                            <th className="px-5 py-3.5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map((u) => (
                                            <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <span className="font-bold text-slate-900">{u.name}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{ROLE_LABELS[u.role] ?? u.role}</td>
                                                <td className="px-5 py-3.5">
                                                    {u.customRoleId ? (
                                                        <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                                                            {customRoleMap.get(u.customRoleId) ?? "Custom"}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-600">{schoolName(u.schoolId)}</td>
                                                <td className="px-5 py-3.5">
                                                    <span
                                                        className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${u.active
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                                            : "bg-slate-100 text-slate-500 border border-slate-200"
                                                            }`}
                                                    >
                                                        {u.active ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOfficerEditModal({ open: true, record: u })}
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                            aria-label={`Assign role for ${u.name}`}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                            Assign role
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setConfirmDialog({
                                                                    open: true,
                                                                    kind: "officer-toggle",
                                                                    record: u,
                                                                })
                                                            }
                                                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${u.active
                                                                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                                : "text-emerald-700 hover:bg-emerald-50"
                                                                }`}
                                                            aria-label={`${u.active ? "Deactivate" : "Reactivate"} ${u.name}`}
                                                        >
                                                            {u.active ? "Deactivate" : "Reactivate"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-6">
                            <LoadingSkeleton rows={6} />
                        </div>
                    ) : loadError ? (
                        <ErrorState message={loadError} onRetry={loadRoles} />
                    ) : roles.length === 0 ? (
                        <EmptyState
                            title="No custom roles"
                            description="Custom roles you create will appear here. Create one to grant targeted access."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="px-5 py-3.5">Role</th>
                                        <th className="px-5 py-3.5">Scope</th>
                                        <th className="px-5 py-3.5">Permissions</th>
                                        <th className="px-5 py-3.5">Description</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {roles.map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <span className="font-bold text-slate-900">{r.name}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span
                                                    className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${r.schoolId
                                                        ? "bg-sky-50 text-sky-700 border border-sky-100"
                                                        : "bg-slate-100 text-slate-600 border border-slate-200"
                                                        }`}
                                                >
                                                    {schoolName(r.schoolId)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-indigo-100 tabular-nums">
                                                    {r.permissions.length} permissions
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                                                {r.description ?? "—"}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRoleModal({ open: true, mode: "edit", record: r })}
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                        aria-label={`Edit role ${r.name}`}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirmDialog({
                                                                open: true,
                                                                kind: "role-delete",
                                                                record: r,
                                                            })
                                                        }
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                        aria-label={`Delete role ${r.name}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <RoleModal
                open={roleModal.open}
                mode={roleModal.mode}
                initial={roleModal.record}
                schools={schools}
                busy={busy}
                error={submitError}
                onClose={() => setRoleModal({ open: false, mode: "create", record: null })}
                onSubmit={handleRoleSubmit}
            />

            <OfficerModal
                open={officerModal}
                customRoles={roles}
                busy={busy}
                error={submitError}
                onClose={() => setOfficerModal(false)}
                onSubmit={handleOfficerCreate}
            />

            <OfficerEditModal
                open={officerEditModal.open}
                record={officerEditModal.record}
                customRoles={roles}
                busy={busy}
                error={submitError}
                onClose={() => setOfficerEditModal({ open: false, record: null })}
                onSubmit={handleOfficerEdit}
            />

            <ConfirmDialog
                open={confirmDialog.open}
                danger={confirmDialog.kind === "role-delete" || confirmOfficerActive}
                title={
                    confirmDialog.kind === "role-delete"
                        ? "Delete role"
                        : confirmOfficerActive
                            ? "Deactivate officer"
                            : "Reactivate officer"
                }
                description={
                    confirmDialog.kind === "role-delete"
                        ? (confirmDialogRecord as RbacRole | null)
                            ? `Delete "${(confirmDialogRecord as RbacRole).name}"? Users with this role will lose its permissions.`
                            : ""
                        : (confirmDialogRecord as RbacUser | null)
                            ? (confirmDialogRecord as RbacUser).active
                                ? `${(confirmDialogRecord as RbacUser).name} will no longer be able to sign in.`
                                : `${(confirmDialogRecord as RbacUser).name} will regain access to the portal.`
                            : ""
                }
                confirmLabel={
                    confirmDialog.kind === "role-delete"
                        ? "Delete role"
                        : confirmOfficerActive
                            ? "Deactivate"
                            : "Reactivate"
                }
                busy={busy}
                onConfirm={confirmDialog.kind === "role-delete" ? handleDeleteRole : handleToggleActive}
                onClose={() => setConfirmDialog({ open: false, kind: "role-delete", record: null })}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
